import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseDocument, stringify } from "yaml";
import { isGraphValue, validateRoutineSpec, type RoutineGraph, type RoutineSpec } from "@npi-deck/protocol";
import { getDb } from "../db/index.ts";
import { loadConfig } from "../config.ts";
import type { GraphNodeRegistry } from "./graph-runner.ts";
import { nativeStepTypes } from "./graph-step-nodes.ts";

export interface MigrationField {
	path: string;
	status: "supported" | "preserved-declaration-only" | "explicit-loss" | "blocked";
	mapping: string;
	/** No source values, YAML fragments or credentials enter an ordinary report. */
	original: string;
}
export interface RoutineMigrationReport {
	routineId: string;
	sourceVersion: number;
	status: "ready" | "blocked" | "native" | "migrated";
	sourceDigest: string;
	fields: MigrationField[];
}
type Row = Record<string, string | number | null> & { id: string; spec_version: number; spec_yaml: string | null; graph_json: string | null };
interface Plan { row: Row; report: RoutineMigrationReport; graph?: RoutineGraph }
interface Conversion { routine_id: string; source_digest: string; original_json: string; converted_graph_json: string; backup_path: string; converted_at: string; restored_at: string | null }
const hash = (text: string | Uint8Array) => createHash("sha256").update(text).digest("hex");
const encode = (value: unknown) => JSON.stringify(value);
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");

function plan(row: Row, registry: GraphNodeRegistry): Plan {
	const sourceDigest = hash(encode(row));
	const report: RoutineMigrationReport = { routineId: row.id, sourceVersion: row.spec_version, status: row.spec_version === 2 ? "native" : "ready", sourceDigest, fields: [] };
	const field = (key: string, status: MigrationField["status"], mapping: string) => {
		const existing = report.fields.find(item => item.path === key);
		if (existing?.status === "blocked") return;
		const entry = { path: key, status, mapping, original: `original:${row.id}:${sourceDigest}#${key}` };
		if (existing) Object.assign(existing, entry); else report.fields.push(entry);
	};
	const block = (key: string, reason: string) => { field(key, "blocked", reason); report.status = "blocked"; };
	if (row.spec_version === 2) return { row, report };
	// Preserve every raw column, including columns a normalized Routine reader hides.
	for (const key of Object.keys(row)) field(`/row/${pointer(key)}`, "supported", "Unchanged in-place metadata and owner-only database backup");
	if (row.spec_version !== 1) {
		block("/row/action_kind", "V0 process argv/prompt and runtime-limit semantics do not yet have equivalent native nodes. Original remains executable and unchanged.");
		return { row, report };
	}
	if (row.graph_json !== null) block("/row/graph_json", "Legacy row already contains a graph; source identity is ambiguous");
	if (getDb().query("SELECT 1 FROM routine_webhook_secrets WHERE routine_id = ?").get(row.id)) block("/row/webhook_registration", "Existing webhook admission requires the legacy reader, even if its declaration is absent. Credentials are not changed.");
	let parsed: unknown;
	try {
		if (typeof row.spec_yaml !== "string") throw new Error("Missing source");
		const document = parseDocument(row.spec_yaml, { uniqueKeys: true });
		if (document.errors.length) throw new Error("Invalid YAML");
		parsed = document.toJS({ maxAliasCount: 100 });
		if (!isGraphValue(parsed)) throw new Error("Non-JSON YAML value");
	} catch {
		block("/spec_yaml", "Malformed, duplicate-key, cyclic, excessive-alias or non-JSON YAML. Inspect the protected original, not this report.");
		return { row, report };
	}
	const validation = validateRoutineSpec(parsed);
	if (!validation.valid) {
		for (const error of validation.errors ?? []) {
			const extra = typeof error.params.additionalProperty === "string" ? `/${pointer(error.params.additionalProperty)}` : "";
			block(`/spec${error.path === "/" ? "" : error.path}${extra}`, `Invalid legacy declaration (${error.keyword}). Original remains unchanged.`);
		}
		return { row, report };
	}
	const spec = parsed as RoutineSpec;
	const mirrors: Record<string, unknown> = {
		concurrency: spec.concurrency ?? "skip", timezone: spec.timezone ?? null,
		tags: spec.tags?.join(",") ?? null,
		cron: (spec.trigger.find(trigger => "cron" in trigger) as { cron: string } | undefined)?.cron ?? "",
	};
	for (const [key, expected] of Object.entries(mirrors)) if (row[key] !== expected) block(`/row/${key}`, "Raw mirrored column disagrees with YAML; no precedence is guessed");
	let budget: unknown = null;
	try { budget = row.budget_json === null ? null : JSON.parse(String(row.budget_json)); }
	catch { block("/row/budget_json", "Malformed raw budget JSON, which normalized readers silently hide"); }
	if (encode(budget) !== encode(spec.budget ?? null)) block("/row/budget_json", "Raw budget disagrees with YAML");
	if (spec.budget && Object.keys(spec.budget).length) for (const key of Object.keys(spec.budget)) block(`/spec/budget/${pointer(key)}`, "Native source/action accounting and abort causes are not proven equivalent to legacy attempt limits");
	if (spec.tags?.some(tag => tag.includes(",") || tag.trim() !== tag)) block("/spec/tags", "Legacy comma-split tags disagree with the declared array");
	if (spec.state) field("/spec/state", "preserved-declaration-only", "Informational declared_keys retained in the protected original and semantic export; persisted routine_state remains unchanged");
	if (spec.layout?.edges?.length) field("/spec/layout/edges", "preserved-declaration-only", "Legacy visual edges never drove execution. Kept in original/export only; not activated as native routing.");
	field("/spec_yaml/syntax", "explicit-loss", "Semantic export does not reproduce comments, anchors, formatting or key order. Exact raw YAML remains in the durable backup.");
	const graph: RoutineGraph = { version: 2, nodes: [], edges: [] };
	for (const key of ["concurrency", "timezone", "tags"] as const) if (spec[key] !== undefined) Object.assign(graph, { [key]: spec[key] });
	if (spec.budget) graph.budget = spec.budget;
	if (spec.layout?.nodes) graph.layout = { nodes: spec.layout.nodes };
	const sources: string[] = [];
	let hasManual = false;
	for (const [index, trigger] of spec.trigger.entries()) {
		if ("webhook" in trigger || "event" in trigger) {
			block(`/spec/trigger/${index}`, "Native webhook management/event admission is not yet migrated. Existing credential registrations are untouched.");
			continue;
		}
		if ("manual" in trigger && trigger.manual && typeof trigger.manual === "object" && Object.keys(trigger.manual).length) {
			block(`/spec/trigger/${index}/manual`, "Manual parameter declarations have no native source config mapping");
			continue;
		}
		const source = `__trigger_${index}`;
		const manual = "manual" in trigger;
		if (manual && hasManual) { block(`/spec/trigger/${index}`, "Duplicate manual sources would introduce duplicate inputs"); continue; }
		hasManual ||= manual;
		graph.nodes.push({ id: source, type: "event.source", config: manual ? { eventType: "manual" } : { eventType: "cron", cron: (trigger as { cron: string }).cron } });
		sources.push(source);
		field(`/spec/trigger/${index}`, "supported", `/graph/nodes/${graph.nodes.length - 1}/config`);
	}
	// All legacy routines admit manual runs, even without a manual declaration.
	if (!hasManual) { sources.push("__manual"); graph.nodes.push({ id: "__manual", type: "event.source", config: { eventType: "manual" } }); }
	const ids = new Set<string>();
	for (const [index, step] of spec.steps.entries()) {
		const base = `/spec/steps/${index}`;
		if (ids.has(step.id)) block(`${base}/id`, "Duplicate step id would overwrite legacy context and cannot identify a native node");
		ids.add(step.id);
		if (!nativeStepTypes.includes(step.type)) block(`${base}/type`, "No equivalent production native node. Agent backend pinning, usage and sandbox semantics remain on the original.");
		if (Object.hasOwn(step, "when")) block(`${base}/when`, "Legacy truthiness/error-skip predicates need a native predicate/context continuation contract");
		if (step.on_failure !== undefined && step.on_failure !== "abort") block(`${base}/on_failure`, "Native failure/continuation ordering is not equivalent to a required-success chain");
		if (Object.hasOwn(step, "retry")) block(`${base}/retry`, "Retry attempt records, charges, delay cancellation and after_retry need a native control contract");
		if (step.type === "write" && typeof row.action_cwd === "string" && row.action_cwd.trim()) block("/row/action_cwd", "Legacy write dispatch uses actionCwd despite its defaultCwd contract. Resolve this ambiguity before conversion.");
		const config = { step: structuredClone(step), ...(typeof row.action_cwd === "string" && row.action_cwd.trim() ? { cwd: row.action_cwd } : {}) };
		const nodeIndex = graph.nodes.length;
		graph.nodes.push({ id: step.id, type: `step.${step.type}`, config: config as unknown as import("@npi-deck/protocol").GraphObject });
		const mapFields = (value: unknown, suffix: string) => {
			field(`${base}${suffix}`, "supported", `/graph/nodes/${nodeIndex}/config/step${suffix}`);
			if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) mapFields(child, `${suffix}/${pointer(key)}`);
		};
		mapFields(step, "");
		if (index === 0) for (const source of sources) graph.edges.push({ id: `${source}_${step.id}`, from: { nodeId: source, port: "event" }, to: { nodeId: step.id, port: "in" } });
		else graph.edges.push({ id: `__edge_${index}_result`, from: { nodeId: spec.steps[index - 1]!.id, port: "result" }, to: { nodeId: step.id, port: "in" } });
	}
	const native = registry.validate(graph);
	if (!native.valid) for (const error of native.errors ?? []) {
		const extra = error.params.unevaluatedProperty ?? error.params.additionalProperty;
		const suffix = typeof extra === "string" ? `/${pointer(extra)}` : "";
		const match = /^\/nodes\/(\d+)\/config\/step(.*)$/.exec(error.path);
		const node = match ? graph.nodes[Number(match[1])] : undefined;
		const stepIndex = node ? spec.steps.findIndex(step => step.id === node.id) : -1;
		block(stepIndex >= 0 ? `/spec/steps/${stepIndex}${match![2]}${suffix}` : `/graph${error.path}${suffix}`, `Production registry refused mapped node/config (${error.keyword}). Unknown fields and unsupported controls are not discarded.`);
	}
	for (const key of ["name", "description", "concurrency", "timezone", "tags", "budget", "layout"] as const) if (Object.hasOwn(spec, key)) field(`/spec/${key}`, "supported", key === "name" || key === "description" ? "Raw row identity remains authoritative; original YAML declaration retained for semantic export" : `/graph/${key}`);
	return { row, report, ...(report.status === "ready" ? { graph } : {}) };
}
function plans(registry: GraphNodeRegistry, routineId?: string): Plan[] {
	const rows = routineId
		? getDb().query<Row, [string]>("SELECT * FROM routines WHERE id = ?").all(routineId)
		: getDb().query<Row, []>("SELECT * FROM routines ORDER BY id").all();
	return rows.map(row => plan(row, registry));
}
export function inspectRoutineMigrations(registry: GraphNodeRegistry, routineId?: string): RoutineMigrationReport[] { return plans(registry, routineId).map(item => item.report); }

/** SQLite serialization includes committed WAL pages, unlike copying the main file. */
function backupDatabase(directory: string): string {
	const bytes = getDb().serialize();
	fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
	fs.chmodSync(directory, 0o700);
	const destination = path.join(directory, `before-routine-graphs-${hash(bytes)}.sqlite`);
	if (fs.existsSync(destination)) {
		if (hash(fs.readFileSync(destination)) !== hash(bytes)) throw new Error("Existing migration backup failed integrity check");
	} else {
		const partial = `${destination}.${crypto.randomUUID()}.partial`;
		try {
			const fd = fs.openSync(partial, "wx", 0o600);
			try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
			fs.renameSync(partial, destination);
		} finally {
			fs.rmSync(partial, { force: true });
		}
	}
	const dir = fs.openSync(directory, "r");
	try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
	return destination;
}

/** Opt-in and synchronous. No scheduler, executor, transport or webhook registration is called. */
export function migrateRoutines(registry: GraphNodeRegistry, options: { routineId?: string; backupDirectory?: string } = {}): { reports: RoutineMigrationReport[]; backupPath?: string } {
	const items = plans(registry, options.routineId);
	const ready = items.filter(item => item.graph);
	if (!ready.length) return { reports: items.map(item => item.report) };
	const backupPath = backupDatabase(options.backupDirectory ?? path.join(path.dirname(loadConfig().dbPath), "routine-migration-backups"));
	for (const item of ready) {
		getDb().transaction(() => {
			const current = getDb().query<Row, [string]>("SELECT * FROM routines WHERE id = ?").get(item.row.id);
			if (!current || encode(current) !== encode(item.row)) throw new Error(`Routine changed during migration: ${item.row.id}`);
			const validation = registry.validate(item.graph);
			if (!validation.valid) throw new Error(`Graph validation changed during migration: ${item.row.id}`);
			const graphJson = encode(item.graph);
			getDb().query("INSERT INTO routine_graph_conversions (routine_id, source_digest, original_json, converted_graph_json, backup_path, converted_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(routine_id, source_digest) DO UPDATE SET converted_graph_json = excluded.converted_graph_json, backup_path = excluded.backup_path, converted_at = excluded.converted_at, restored_at = NULL").run(item.row.id, item.report.sourceDigest, encode(item.row), graphJson, backupPath, new Date().toISOString());
			getDb().query("UPDATE routines SET spec_version = 2, graph_json = ?, spec_yaml = NULL WHERE id = ?").run(graphJson, item.row.id);
		}).immediate();
		item.report.status = "migrated";
	}
	return { reports: items.map(item => item.report), backupPath };
}

/** Restore the exact pre-conversion definition only; never undo later external actions. */
export function restoreRoutineDefinition(routineId: string, sourceDigest: string): void {
	getDb().transaction(() => {
		const conversion = getDb().query<Conversion, [string, string]>("SELECT * FROM routine_graph_conversions WHERE routine_id = ? AND source_digest = ?").get(routineId, sourceDigest);
		if (!conversion) throw new Error("Conversion not found");
		if (conversion.restored_at !== null) return;
		const current = getDb().query<Row, [string]>("SELECT * FROM routines WHERE id = ?").get(routineId);
		if (!current || current.spec_version !== 2 || current.graph_json !== conversion.converted_graph_json) throw new Error("Native definition changed; restore the protected database backup offline instead");
		const original = JSON.parse(conversion.original_json) as Row;
		// Metadata edits must not disappear as a side effect of restoration.
		const expected: Row = { ...original, spec_version: 2, spec_yaml: null, graph_json: conversion.converted_graph_json };
		for (const key of Object.keys(expected)) {
			if (key === "last_run_at" || key === "next_run_at") continue;
			if (current[key] !== expected[key]) throw new Error("Routine metadata changed since conversion");
		}
		getDb().query("UPDATE routines SET spec_version = ?, spec_yaml = ?, graph_json = ?, cron = ?, action_kind = ?, action_body = ?, action_cwd = ?, concurrency = ?, budget_json = ?, timezone = ?, tags = ? WHERE id = ?").run(original.spec_version, original.spec_yaml, original.graph_json, original.cron!, original.action_kind!, original.action_body!, original.action_cwd!, original.concurrency!, original.budget_json!, original.timezone!, original.tags!, routineId);
		getDb().query("UPDATE routine_graph_conversions SET restored_at = ? WHERE routine_id = ? AND source_digest = ?").run(new Date().toISOString(), routineId, sourceDigest);
	}).immediate();
}

/** One-shot semantic YAML export, not an authoring or execution source. Refuse edited topology. */
export function exportRoutineMigration(routineId: string, sourceDigest: string): string {
	const conversion = getDb().query<Conversion, [string, string]>("SELECT * FROM routine_graph_conversions WHERE routine_id = ? AND source_digest = ?").get(routineId, sourceDigest);
	if (!conversion) throw new Error("Conversion not found");
	const row = JSON.parse(conversion.original_json) as Row;
	// The immutable converted graph and raw definition prove omitted/false/zero/null distinctions.
	// Exporting later native edits as legacy YAML would invent a reverse mapping; refuse that.
	const current = getDb().query<Row, [string]>("SELECT * FROM routines WHERE id = ?").get(routineId);
	if (!current || (current.spec_version === 2 && current.graph_json !== conversion.converted_graph_json)) throw new Error("Native definition changed; use native graph export");
	return stringify(parseDocument(row.spec_yaml!, { uniqueKeys: true }).toJS({ maxAliasCount: 100 }));
}
