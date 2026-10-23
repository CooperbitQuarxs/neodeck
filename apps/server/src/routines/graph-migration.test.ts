import { afterEach, beforeEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse, stringify } from "yaml";
import type { RoutineGraph, RoutineSpec } from "@npi-deck/protocol";
import { closeDb, getDb, openDb } from "../db/index.ts";
import { createGraphRoutine, createRoutine, createV1Routine, getGraphRun, getRoutine, listRuns, startRun, updateGraphRoutine } from "../db/routines.ts";
import { upsertWebhookSecret } from "../db/routine-step-runs.ts";
import { initializeOwnedGeneration, stopOwnedProcesses } from "../owned-process.ts";
import { buildRoutinesRouter } from "../routes-routines.ts";
import { RoutinesRunner } from "../routines-runner.ts";
import { exportRoutineMigration, inspectRoutineMigrations, migrateRoutines, restoreRoutineDefinition } from "./graph-migration.ts";
import { findGraphOutput } from "./graph-runner.ts";
import { loadState, saveState } from "./state.ts";

let home = "";
let runner: RoutinesRunner;
let server: ReturnType<typeof Bun.serve> | undefined;
const keys = ["NPI_DECK_HOME", "NPI_DECK_DB_PATH", "NPI_DECK_DEFAULT_CWD", "PI_CODING_AGENT_DIR"] as const;
let prior: Partial<Record<typeof keys[number], string | undefined>>;
beforeEach(() => {
	prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
	home = fs.mkdtempSync(path.join(os.tmpdir(), "neodeck-migration-"));
	process.env.NPI_DECK_HOME = home;
	process.env.NPI_DECK_DB_PATH = path.join(home, "deck.db");
	process.env.NPI_DECK_DEFAULT_CWD = home;
	process.env.PI_CODING_AGENT_DIR = path.join(home, "agent");
	openDb({ path: process.env.NPI_DECK_DB_PATH });
	initializeOwnedGeneration();
	runner = new RoutinesRunner();
});
afterEach(async () => {
	try {
		server?.stop(true); server = undefined;
		await runner?.dispose();
	} finally {
		try { await stopOwnedProcesses(); }
		finally {
			try { closeDb(); }
			finally {
				for (const key of keys) if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key];
				if (home) fs.rmSync(home, { recursive: true, force: true });
			}
		}
	}
});
function spec(steps: RoutineSpec["steps"] = [{ id: "value", type: "transform", body: "return context.trigger;" }]): RoutineSpec {
	return { name: "migration-fixture", trigger: [{ manual: {} }], steps };
}
function seed(source = spec(), raw = stringify(source)) {
	return createV1Routine({ name: source.name, description: source.description, spec: source, specYaml: raw, enabled: false });
}
function migrate(id: string) { return migrateRoutines(runner.graphRegistry, { routineId: id, backupDirectory: path.join(home, "backups") }); }
function row(id: string) { return getDb().query<Record<string, unknown>, [string]>("SELECT * FROM routines WHERE id = ?").get(id)!; }
function graph(id: string): RoutineGraph { return getRoutine(id)!.graph!; }
function request(method = "POST", body?: unknown): RequestInit { return { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) }; }

// Reproduces the current persisted shape before conversion, without running an original.
test("saved YAML has no native definition until explicit conversion; migration never executes", () => {
	const source = spec([{ id: "write", type: "write", path: "must-not-exist.txt", content: "not during migration" }]);
	const routine = seed(source, `# retain this exact original\n${stringify(source)}`);
	const before = row(routine.id);
	expect(getRoutine(routine.id)?.graph).toBeUndefined();
	expect(inspectRoutineMigrations(runner.graphRegistry, routine.id)[0]?.status).toBe("ready");
	expect(row(routine.id)).toEqual(before);
	const converted = migrate(routine.id);
	expect(converted.reports[0]?.status).toBe("migrated");
	expect(fs.existsSync(path.join(home, "must-not-exist.txt"))).toBe(false);
	expect(listRuns(routine.id)).toEqual([]);
	expect(row(routine.id)).toEqual({ ...before, spec_version: 2, spec_yaml: null, graph_json: JSON.stringify(graph(routine.id)) });
	expect(fs.statSync(converted.backupPath!).mode & 0o777).toBe(0o600);
	expect(fs.statSync(path.dirname(converted.backupPath!)).mode & 0o777).toBe(0o700);
});

test("semantic export and reimport retain omitted/false/zero/null/empty/nested values and references", () => {
	const source = spec([
		{ id: "data", type: "transform", body: "return { list: [false, 0, null, '', 'truthy'], nested: { yes: true } };", on_failure: "abort", timeout_secs: 17 },
		{ id: "fetch", type: "http", method: "POST", url: "http://127.0.0.1/unused", headers: {}, query: { zero: 0, flag: false, empty: "" }, body: { from: "{{ steps.data.json.list }}", nested: [null, false, 0, ""] }, expect_json: false },
		{ id: "write", type: "write", path: "unused.txt", content: "", append: false },
		{ id: "wait", type: "wait", duration_secs: 0 },
	]);
	source.state = { declared_keys: [] };
	source.layout = { version: 1, nodes: { data: { x: 0, y: -10, collapsed: false } }, edges: [{ from: "data", to: "write", kind: "manual", label: "display only" }] };
	const first = seed(source);
	const result = migrate(first.id);
	expect(result.reports[0]?.status).toBe("migrated");
	const exported = parse(exportRoutineMigration(first.id, result.reports[0]!.sourceDigest)) as RoutineSpec;
	expect(exported).toEqual(source);
	const second = seed(exported);
	expect(migrate(second.id).reports[0]?.status).toBe("migrated");
	expect(graph(second.id)).toEqual(graph(first.id));
	expect(result.reports[0]?.fields.find(field => field.path === "/spec/layout/edges")?.status).toBe("preserved-declaration-only");
	expect(graph(first.id).edges.some(edge => edge.id === "display only")).toBe(false);
});

test("completion survives restart and repeat conversion creates no new rows, nodes or backups", () => {
	const routine = seed();
	const first = migrate(routine.id);
	const saved = row(routine.id);
	closeDb(); openDb({ path: path.join(home, "deck.db") });
	const repeated = migrate(routine.id);
	expect(repeated.reports[0]?.status).toBe("native");
	expect(repeated.backupPath).toBeUndefined();
	expect(row(routine.id)).toEqual(saved);
	expect(getDb().query("SELECT * FROM routine_graph_conversions").all()).toHaveLength(1);
	expect(fs.readdirSync(path.dirname(first.backupPath!))).toHaveLength(1);
});

test("full backup retains raw definitions, state, webhook credentials and historical relationships", () => {
	const routine = seed();
	const registered = seed({ ...spec(), name: "other-original" });
	upsertWebhookSecret({ routineId: registered.id, path: "/hooks/original", secret: "test-only-signing-key" });
	saveState(routine.id, { original: { nested: [false, 0, null] } });
	const historical = startRun(routine.id, "manual", { before: true });
	const before = row(routine.id);
	const result = migrate(routine.id);
	const backup = new Database(result.backupPath!, { readonly: true });
	try {
		expect(backup.query("SELECT * FROM routines WHERE id = ?").get(routine.id)).toEqual(before);
		expect(backup.query("SELECT * FROM routine_state WHERE routine_id = ?").all(routine.id)).toEqual(getDb().query("SELECT * FROM routine_state WHERE routine_id = ?").all(routine.id));
		expect(backup.query("SELECT * FROM routine_webhook_secrets").all()).toEqual(getDb().query("SELECT * FROM routine_webhook_secrets").all());
		expect(backup.query("SELECT routine_id FROM routine_runs WHERE id = ?").get(historical.id)).toEqual({ routine_id: routine.id });
	} finally { backup.close(); }
	expect(listRuns(routine.id)[0]?.id).toBe(historical.id);
	restoreRoutineDefinition(routine.id, result.reports[0]!.sourceDigest);
	expect(row(routine.id)).toEqual(before);
	restoreRoutineDefinition(routine.id, result.reports[0]!.sourceDigest);
	expect(row(routine.id)).toEqual(before);
});

test("backup failure and precommit interruption leave originals intact, then retry once", () => {
	const routine = seed();
	const before = row(routine.id);
	const notDirectory = path.join(home, "not-a-directory"); fs.writeFileSync(notDirectory, "file");
	expect(() => migrateRoutines(runner.graphRegistry, { routineId: routine.id, backupDirectory: notDirectory })).toThrow();
	expect(row(routine.id)).toEqual(before);
	getDb().exec("CREATE TRIGGER interrupt_migration BEFORE UPDATE OF graph_json ON routines BEGIN SELECT RAISE(ABORT, 'simulated interruption'); END");
	expect(() => migrate(routine.id)).toThrow("simulated interruption");
	expect(row(routine.id)).toEqual(before);
	expect(getDb().query("SELECT * FROM routine_graph_conversions").all()).toEqual([]);
	closeDb(); openDb({ path: path.join(home, "deck.db") });
	getDb().exec("DROP TRIGGER interrupt_migration");
	expect(migrate(routine.id).reports[0]?.status).toBe("migrated");
	expect(getDb().query("SELECT * FROM routine_graph_conversions").all()).toHaveLength(1);
});

test("production native execution keeps truthy/false/zero/null/empty results and original inputs after native edits/restart", async () => {
	for (const value of [false, 0, null, "", "truthy-not-true", true, { nested: [1, false, null] }]) {
		const routine = seed(spec([
			{ id: "first", type: "transform", body: "return context.trigger.value;" },
			{ id: "second", type: "transform", body: "return context.steps.first.json;" },
		]));
		expect(migrate(routine.id).reports[0]?.status).toBe("migrated");
		await runner.fire(routine.id, "manual", { value });
		const run = listRuns(routine.id)[0]!;
		const trace = getGraphRun(run.id)!;
		expect(trace.status).toBe("success");
		const second = trace.nodeRuns.find(node => node.nodeId === "second")!;
		const actual = second.outputs.find(output => output.port === "result")!;
		expect(actual.result).toEqual(value !== null && typeof value === "object" && !Array.isArray(value) ? value : { value });
		expect(findGraphOutput(actual, "__trigger_0")?.result).toEqual({ value });
		const original = graph(routine.id);
		updateGraphRoutine(routine.id, { graph: { version: 2, nodes: [{ id: "new", type: "event.source", config: { eventType: "manual" } }], edges: [] } }, runner.graphRegistry);
		closeDb(); openDb({ path: path.join(home, "deck.db") });
		expect(getGraphRun(run.id)?.graph).toEqual(original);
		expect(getGraphRun(run.id)?.nodeRuns.find(node => node.nodeId === "second")?.outputs.find(output => output.port === "result")?.result).toEqual(actual.result);
	}
});

test("saved graph executes isolated shell/write/append/state nodes in order and keeps state across restart", async () => {
	const routine = seed(spec([
		{ id: "shell", type: "run", command: "printf 'shell-result'" },
		{ id: "write", type: "write", path: "output/note.txt", content: "{{ steps.shell.stdout }}", append: false },
		{ id: "append", type: "write", path: "output/note.txt", content: "-tail", append: true },
		{ id: "set", type: "set_state", state: { count: "{{ (state.count || 0) + 1 }}", exact: { nested: [false, 0, null, ""] } } },
		{ id: "read", type: "transform", body: "return context.state;" },
	]));
	expect(migrate(routine.id).reports[0]?.status).toBe("migrated");
	for (const count of [1, 2]) {
		await runner.fire(routine.id);
		expect(fs.readFileSync(path.join(home, "output/note.txt"), "utf8")).toBe("shell-result-tail");
		expect(loadState(routine.id)).toEqual({ count, exact: { nested: [false, 0, null, ""] } });
		const trace = getGraphRun(listRuns(routine.id)[0]!.id)!;
		expect(trace.status).toBe("success");
		expect(trace.nodeRuns.find(node => node.nodeId === "read")?.outputs.find(output => output.port === "result")?.result).toEqual(loadState(routine.id));
		closeDb(); openDb({ path: path.join(home, "deck.db") });
	}
});

test("native HTTP uses the real local transport with typed deep substitutions and golden-rule trace", async () => {
	let received: unknown;
	server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async request => { received = await request.json(); return Response.json({ exact: received }); } });
	const routine = seed(spec([
		{ id: "payload", type: "transform", body: "return { nested: [false, 0, null, '', 'truthy'] };" },
		{ id: "send", type: "http", method: "POST", url: `http://127.0.0.1:${server.port}/record`, body: { typed: "{{ steps.payload.json.nested }}" }, expect_json: true },
	]));
	expect(migrate(routine.id).reports[0]?.status).toBe("migrated");
	await runner.fire(routine.id);
	expect(received).toEqual({ typed: [false, 0, null, "", "truthy"] });
	const trace = getGraphRun(listRuns(routine.id)[0]!.id)!;
	expect(trace.status).toBe("success");
	expect(JSON.stringify(trace)).not.toContain("Bearer ");
});

test("actual bundled YAML templates stay unchanged with exact field-level blockers and no secret values", () => {
	for (const slug of ["daily-briefing", "kb-orphan-census"]) {
		const raw = fs.readFileSync(new URL(`../templates/${slug}.yaml`, import.meta.url), "utf8");
		const source = parse(raw) as RoutineSpec;
		const routine = seed(source, raw);
		const before = row(routine.id);
		const result = migrate(routine.id);
		expect(result.reports[0]?.status).toBe("blocked");
		expect(result.reports[0]?.fields.some(field => field.path.startsWith("/spec/budget/") && field.status === "blocked")).toBe(true);
		expect(row(routine.id)).toEqual(before);
		expect(listRuns(routine.id)).toEqual([]);
	}
});

test("V0 actions, unknown keys, malformed budgets, duplicate ids and unsupported controls are never rewritten", () => {
	const cases = [
		{ id: "a", type: "transform", body: "return 1;", when: "'truthy'" },
		{ id: "a", type: "transform", body: "return 1;", on_failure: "continue" },
		{ id: "a", type: "transform", body: "return 1;", retry: { times: 2, backoff: "linear" }, on_failure: "retry" },
		{ id: "a", type: "transform", body: "return 1;", on_error: "ignored-but-not-aliased" },
		{ id: "a", type: "agent", prompt: "NEVER RUN THIS", skills_allowed: [], mcp_servers_allowed: [] },
	] as RoutineSpec["steps"];
	const routines = cases.map(step => seed(spec([step])));
	routines.push(seed(spec([{ id: "a", type: "wait", duration_secs: 0 }, { id: "a", type: "wait", duration_secs: 0 }])));
	for (const raw of ["name: broken\nname: duplicate", "bad: [", "name: other\ntrigger: []\nsteps: []\nversion: 1"]) routines.push(seed(spec(), raw));
	const malformed = seed(); getDb().query("UPDATE routines SET budget_json = ? WHERE id = ?").run("not-json-test-secret", malformed.id); routines.push(malformed);
	const mirrored = seed(); getDb().query("UPDATE routines SET concurrency = 'parallel' WHERE id = ?").run(mirrored.id); routines.push(mirrored);
	for (const kind of ["bash", "script", "prompt"] as const) routines.push(createRoutine({ name: `v0-${kind}`, cron: "0 1 * * *", actionKind: kind, actionBody: "NEVER EXECUTE", enabled: false }));
	for (const routine of routines) {
		const before = row(routine.id);
		const report = migrate(routine.id).reports[0]!;
		expect(report.status).toBe("blocked");
		expect(report.fields.some(field => field.status === "blocked")).toBe(true);
		expect(JSON.stringify(report)).not.toContain("not-json-test-secret");
		expect(JSON.stringify(report)).not.toContain("NEVER EXECUTE");
		expect(row(routine.id)).toEqual(before);
	}
});

test("migration endpoints preflight, block unsafe originals, export/restore and never run during apply", async () => {
	const routine = seed();
	const api = buildRoutinesRouter(runner);
	const inventory = await api.request("/routine-migrations");
	expect(inventory.status).toBe(200);
	const converted = await api.request(`/routine-migrations/${routine.id}`, request());
	expect(converted.status).toBe(200);
	const body = await converted.json() as { reports: Array<{ sourceDigest: string }> };
	expect(listRuns(routine.id)).toEqual([]);
	const digest = body.reports[0]!.sourceDigest;
	expect((await api.request(`/routine-migrations/${routine.id}/${digest}/export`)).status).toBe(200);
	expect((await api.request(`/routine-migrations/${routine.id}/${digest}/restore`, request())).status).toBe(200);
	expect(getRoutine(routine.id)?.specVersion).toBe(1);
	const blocked = seed(spec([{ id: "skip", type: "wait", duration_secs: 0, when: "false" }]));
	expect((await api.request(`/routine-migrations/${blocked.id}`, request())).status).toBe(409);
	expect((await api.request("/routine-migrations/missing", request())).status).toBe(404);
});

test("native edits prevent stale restoration/export and dry runs dispatch no actions", async () => {
	const routine = seed(spec([{ id: "write", type: "write", path: "preview.txt", content: "no" }]));
	const result = migrate(routine.id);
	await runner.fire(routine.id, "manual", {}, { dryRun: true });
	expect(fs.existsSync(path.join(home, "preview.txt"))).toBe(false);
	const edited = structuredClone(graph(routine.id)); edited.nodes.find(node => node.id === "write")!.config.step = { id: "write", type: "write", path: "other.txt", content: "different" };
	updateGraphRoutine(routine.id, { graph: edited }, runner.graphRegistry);
	expect(() => restoreRoutineDefinition(routine.id, result.reports[0]!.sourceDigest)).toThrow("changed");
	expect(() => exportRoutineMigration(routine.id, result.reports[0]!.sourceDigest)).toThrow("changed");
	const newlyAuthored = createGraphRoutine({ name: "new-native", graph: edited, enabled: false }, runner.graphRegistry);
	expect(newlyAuthored.specVersion).toBe(2);
	expect(newlyAuthored.specYaml).toBeUndefined();
});

test("failure aborts later actions while native diagnostics retain the actual failed handler result", async () => {
	const routine = seed(spec([
		{ id: "failed", type: "run", command: "printf 'partial-out'; printf 'partial-err' >&2; exit 7" },
		{ id: "not_run", type: "write", path: "not-run.txt", content: "must not write" },
	]));
	expect(migrate(routine.id).reports[0]?.status).toBe("migrated");
	await runner.fire(routine.id);
	const trace = getGraphRun(listRuns(routine.id)[0]!.id)!;
	expect(trace.status).toBe("failed");
	expect(trace.nodeRuns.find(node => node.nodeId === "failed")?.diagnostics?.result).toMatchObject({
		status: "failed", stdoutExcerpt: "partial-out", stderrExcerpt: "partial-err", error: "exit code 7",
	});
	expect(trace.nodeRuns.find(node => node.nodeId === "not_run")?.status).toBe("skipped");
	expect(fs.existsSync(path.join(home, "not-run.txt"))).toBe(false);
});

test("copied deck fixture shapes preserve card properties and reads without touching a live database", async () => {
	const routine = seed(spec([
		{ id: "create", type: "deck", action: "create_task", title: "Migration fixture", body: "body", properties: { custom: { nested: [false, 0, null, ""] } }, cwd: home },
		{ id: "fetch", type: "deck", action: "get_task", task_ref: "{{ steps.create.json.id }}" },
		{ id: "list", type: "deck", action: "list_tasks", include_archived: false, limit: 1, since_hours: 24 },
		{ id: "inbox", type: "deck", action: "create_inbox_item", kind: "capture", title: "Copied briefing action", body: "{{ steps.fetch.json.title }}", source: "routine:migration-test" },
	]));
	expect(migrate(routine.id).reports[0]?.status).toBe("migrated");
	await runner.fire(routine.id);
	const trace = getGraphRun(listRuns(routine.id)[0]!.id)!;
	expect(trace.status).toBe("success");
	const created = trace.nodeRuns.find(node => node.nodeId === "create")!.outputs[0]!.result;
	expect(created.body).toContain("custom:");
	expect(trace.nodeRuns.find(node => node.nodeId === "fetch")!.outputs[0]!.result.id).toBe(created.id);
	expect(trace.nodeRuns.find(node => node.nodeId === "inbox")!.outputs[0]!.result.title).toBe("Copied briefing action");
});
