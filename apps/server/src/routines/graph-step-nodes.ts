import { isGraphValue, type GraphObject, type GraphOutput, type RoutineStep } from "@npi-deck/protocol";
import commonSchema from "../../../../packages/protocol/src/schemas/step-common.json";
import runSchema from "../../../../packages/protocol/src/schemas/step-run.json";
import writeSchema from "../../../../packages/protocol/src/schemas/step-write.json";
import httpSchema from "../../../../packages/protocol/src/schemas/step-http.json";
import deckSchema from "../../../../packages/protocol/src/schemas/step-deck.json";
import mcpSchema from "../../../../packages/protocol/src/schemas/step-mcp.json";
import transformSchema from "../../../../packages/protocol/src/schemas/step-transform.json";
import waitSchema from "../../../../packages/protocol/src/schemas/step-wait.json";
import stateSchema from "../../../../packages/protocol/src/schemas/step-set_state.json";
import { loadConfig } from "../config.ts";
import { getRun } from "../db/routines.ts";
import type { GraphNodeContext, GraphNodeRegistry } from "./graph-runner.ts";
import { loadState } from "./state.ts";
import { executeRunStep } from "./steps/run.ts";
import { executeWriteStep } from "./steps/write.ts";
import { executeHttpStep } from "./steps/http.ts";
import { executeDeckStep } from "./steps/deck.ts";
import { executeMcpStep } from "./steps/mcp.ts";
import { executeTransformStep } from "./steps/transform.ts";
import { executeWaitStep } from "./steps/wait.ts";
import { executeSetStateStep } from "./steps/set_state.ts";
import type { RunContext, StepContextEntry, StepResult } from "./types.ts";

const schemas = { run: runSchema, write: writeSchema, http: httpSchema, deck: deckSchema, mcp: mcpSchema, transform: transformSchema, wait: waitSchema, set_state: stateSchema };
export const nativeStepTypes = Object.keys(schemas);

/** The same action schemas as the existing handlers, with unsupported controls refused. */
function configSchema(schema: unknown): GraphObject {
	const common = { ...commonSchema, properties: { ...commonSchema.properties, when: false, retry: false, on_failure: { const: "abort" } } };
	const inline = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(inline);
		if (!value || typeof value !== "object") return value;
		if ("$ref" in value && value.$ref === commonSchema.$id) return inline(common);
		return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$id" && key !== "$schema").map(([key, item]) => [key, inline(item)]));
	};
	return { type: "object", required: ["step"], properties: { step: { ...inline(schema) as GraphObject, unevaluatedProperties: false }, cwd: { type: "string" } }, additionalProperties: false };
}

/** Project legacy access from the shared native trace; original outputs stay intact. */
function runContext(context: GraphNodeContext): RunContext {
	const started = context.priorNodeRuns?.find(record => record.startedAt)?.startedAt ?? getRun(context.runId)?.startedAt ?? new Date().toISOString();
	const ancestors = new Set<string>();
	const visit = (output: GraphOutput) => {
		if (ancestors.has(output.nodeId)) return;
		ancestors.add(output.nodeId);
		output.inputs.forEach(visit);
	};
	context.inputs.forEach(input => visit(input.output));
	const entries: Record<string, StepContextEntry> = {};
	let state: Record<string, unknown> | undefined;
	for (const record of context.priorNodeRuns ?? []) {
		const diagnostic = record.diagnostics;
		if (!ancestors.has(record.nodeId) || !record.type.startsWith("step.") || !diagnostic || typeof diagnostic.stepId !== "string") continue;
		const entry = diagnostic.entry;
		if (entry && typeof entry === "object" && !Array.isArray(entry)) entries[diagnostic.stepId] = entry as unknown as StepContextEntry;
		if (diagnostic.state && typeof diagnostic.state === "object" && !Array.isArray(diagnostic.state)) state = diagnostic.state;
	}
	return {
		run: { id: context.runId, started, iso_started: started, date: started.slice(0, 10), trigger_kind: context.activation.eventType as RunContext["run"]["trigger_kind"] },
		trigger: context.activation.event, steps: entries,
		env: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
		secrets: {}, state: state ? structuredClone(state) : context.routineId ? loadState(context.routineId) : {},
	};
}
async function dispatch(step: RoutineStep, context: RunContext, signal: AbortSignal, cwd: string, graph: GraphNodeContext): Promise<StepResult> {
	switch (step.type) {
		case "run": return executeRunStep(step, context, signal, cwd);
		case "write": return executeWriteStep(step, context, signal, cwd);
		case "http": return executeHttpStep(step, context, signal, graph.runId);
		case "deck": return executeDeckStep(step, context, signal);
		case "mcp": return executeMcpStep(step, context, signal, cwd);
		case "transform": return executeTransformStep(step, context, signal);
		case "wait": return executeWaitStep(step, context, signal);
		case "set_state": {
			if (!graph.routineId) throw new Error("State nodes require a persisted routine");
			return executeSetStateStep(step, context, signal, graph.routineId);
		}
		default: throw new Error(`Unsupported native step: ${step.type}`);
	}
}

/** Native actions also available to newly authored graphs. No YAML is read at execution. */
export function registerGraphStepNodes(registry: GraphNodeRegistry): void {
	for (const [type, schema] of Object.entries(schemas)) registry.register({
		definition: {
			type: `step.${type}`, label: `Routine ${type}`, kind: type === "transform" || type === "wait" ? "operation" : "action",
			inputs: [{ id: "in", type: "object", multiple: true }],
			outputs: [{ id: "result", type: "object" }],
			configSchema: configSchema(schema),
		},
		execute: async graph => {
			// A preview must never dispatch a process, write, HTTP/MCP call or state mutation.
			if (graph.dryRun) return [];
			const step = graph.node.config.step as unknown as RoutineStep;
			if (step.type !== type) throw new Error("Step type must match native node type");
			const controller = new AbortController();
			const abort = () => controller.abort(graph.signal.reason);
			graph.signal.addEventListener("abort", abort, { once: true });
			if (graph.signal.aborted) abort();
			let timedOut = false;
			const timer = setTimeout(() => { timedOut = true; controller.abort(new Error("step timed out")); }, (step.timeout_secs ?? 60) * 1000);
			try {
				controller.signal.throwIfAborted();
				const context = runContext(graph);
				const result = await dispatch(step, context, controller.signal, graph.node.config.cwd as string | undefined ?? loadConfig().defaultCwd, graph);
				const entry: StepContextEntry = { status: result.status, stdout: result.stdoutExcerpt, stderr: result.stderrExcerpt, duration_ms: result.durationMs };
				if (result.json !== undefined) entry.json = result.json;
				const diagnostic: unknown = { stepId: step.id, entry, state: context.state, result: JSON.parse(JSON.stringify(result)), timedOut };
				if (!isGraphValue(diagnostic) || diagnostic === null || typeof diagnostic !== "object" || Array.isArray(diagnostic)) throw new Error("Step returned non-JSON diagnostics");
				graph.recordDiagnostics?.(diagnostic);
				if (timedOut) throw new Error("step timed out");
				controller.signal.throwIfAborted();
				if (result.status !== "success") throw new Error(result.error ?? `${type} ${result.status}`);
				// Scalars, arrays and null are enveloped only by the shared graph executor.
				const value = result.json === undefined ? result.stdoutExcerpt : result.json;
				if (!isGraphValue(value)) throw new Error("Step returned a non-JSON value");
				return [{ port: "result", value }];
			} finally {
				clearTimeout(timer);
				graph.signal.removeEventListener("abort", abort);
			}
		},
	});
}
