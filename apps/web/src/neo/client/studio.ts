import { routinesApi } from "@/lib/routines-api";
import { PREVIEW_GRAPHS } from "./preview-data";
import { SOURCES } from "./source";
import { compatible, nodePorts, nodeType, type BuildableKind, type GraphKind } from "../pages/studio/vocab";

export type { GraphKind, BuildableKind };
/** A graph listed in Studio. Flows use their routine id; map has the fixed id map. */
export interface GraphSummary { id: string; kind: GraphKind; name: string; description: string; nodes: number; enabled: boolean; lastRun?: { at: string; ok: boolean } }
/** Authored graph contract for GET/PUT /api/graphs/:id. Positions are canvas coordinates. */
export interface StudioGraph { id: string; kind: BuildableKind; name: string; description: string; enabled: boolean; nodes: StudioNode[]; edges: StudioEdge[]; settings: Record<string, unknown>; lastRun?: { at: string; ok: boolean }; updatedAt: string }
/** One vocabulary node and its serializable field values. */
export interface StudioNode { id: string; type: string; config: Record<string, unknown>; position: { x: number; y: number } }
/** A directed, typed connection between named ports. */
export interface StudioEdge { id: string; from: { node: string; port: string }; to: { node: string; port: string } }
/** Execution evidence returned by /api/graphs/:id/runs, with one timing per visited node. */
export interface StudioRun { id: string; graphId: string; startedAt: string; endedAt?: string; ok: boolean | null; trigger: string; costUsd?: number; nodes: { nodeId: string; startedAt: string; endedAt?: string; status: "ok" | "failed" | "skipped" | "running"; note?: string }[] }
/** Shared operations for live routine graphs and the future graph backend. */
export interface StudioClient { list(): Promise<GraphSummary[]>; get(id: string): Promise<StudioGraph>; save(graph: StudioGraph): Promise<StudioGraph>; create(kind: BuildableKind, name: string): Promise<StudioGraph>; remove(id: string): Promise<void>; setEnabled(id: string, enabled: boolean): Promise<void>; run(id: string): Promise<StudioRun>; runs(id: string): Promise<StudioRun[]> }
/** Validation problem shown on the canvas and linked to its first affected node. */
export interface GraphProblem { nodeId?: string; message: string }
export function graphProblems(graph: StudioGraph): GraphProblem[] {
 const problems: GraphProblem[] = [];
 if (!graph.name.trim()) problems.push({ message: "Give this graph a name." });
 for (const n of graph.nodes) {
  if (!nodeType(n.type) || nodeType(n.type)?.kind !== graph.kind) problems.push({ nodeId: n.id, message: `Unknown ${graph.kind} node: ${n.type}.` });
 }
 if (graph.nodes.length === 0) problems.push({ message: "Add a node to start this graph." });
 const ids = new Set<string>();
 for (const n of graph.nodes) { if (ids.has(n.id)) problems.push({ nodeId: n.id, message: `Node id ${n.id} is repeated.` }); ids.add(n.id); }
 for (const e of graph.edges) {
  const source = graph.nodes.find(n => n.id === e.from.node), target = graph.nodes.find(n => n.id === e.to.node);
  const out = source && nodePorts(source).outputs.find(p => p.id === e.from.port), input = target && nodePorts(target).inputs.find(p => p.id === e.to.port);
  if (!out || !input) problems.push({ nodeId: source?.id ?? target?.id, message: "A connection points to a missing node or port. Remove it or restore the port." });
  else if (!compatible(out, input)) problems.push({ nodeId: target?.id, message: `Cannot connect ${out.type} to ${input.type}. Choose matching ports.` });
 }
 return problems;
}
const n = (id: string, type: string, x: number, y: number, config: Record<string, unknown>): StudioNode => ({ id, type, position: { x, y }, config });
const e = (from: string, to: string, fromPort = "output", toPort = "input"): StudioEdge => ({ id: `${from}:${fromPort}-${to}:${toPort}`, from: { node: from, port: fromPort }, to: { node: to, port: toPort } });
const now = Date.now();
function fixture(id: string, nodes: StudioNode[], edges: StudioEdge[], settings: Record<string, unknown> = {}): StudioGraph {
 const summary = PREVIEW_GRAPHS.find(g => g.id === id)!;
 const positioned = nodes.map((node, index) => {
  let position = summary.kind === "router"
   ? { x: node.position.x / 370 * 205, y: node.position.y }
   : { x: node.position.x * .75, y: node.position.y * .75 };
  if (id === "c_kind" && node.type === "cls.output") {
   const outputIndex = index - 2;
   position = { x: outputIndex % 3 * 270, y: 370 + Math.floor(outputIndex / 3) * 160 };
  }
  if (id === "p_inbox" && node.type.startsWith("out.")) {
   const outputIndex = index - 3;
   position = { x: 140 + outputIndex % 2 * 310, y: 480 + Math.floor(outputIndex / 2) * 170 };
  }
  return { ...node, position };
 });
 const description = id === "r_heavy" ? "Astra 5% each, cap 15% per user; demote to Sol" : id === "r_default" ? "Sonnet, then Luna; per-user weekly caps" : summary.description;
 return { ...summary, description, nodes: positioned, edges, settings, updatedAt: new Date(now).toISOString() };
}
const fixtures: StudioGraph[] = [
 fixture("p_pr", [
  n("pr", "event.pr_opened", 380, 0, { name: "PR opened", filter: "office/atlas" }),
  n("sonnet", "infer.request", 20, 170, { name: "Reviewer A", model: "neoproxy/anthropic/claude-sonnet-5-5", system: "Review correctness and maintainability.", prompt: "Review {{input}}. Cite concrete defects." }),
  n("sol", "infer.request", 380, 170, { name: "Reviewer B", model: "neoproxy/codex/gpt-6.1-sol", system: "Review correctness and security.", prompt: "Review {{input}}. Trace the changed paths." }),
  n("grok", "infer.request", 740, 170, { name: "Reviewer C", model: "neoproxy/xai/grok-4.7", system: "Look for missing assumptions.", prompt: "Review {{input}}. Check edge cases." }),
  n("merge", "transform.merge", 380, 350, { name: "Collect reviews", separator: "\n\n" }),
  n("judge", "route.classify", 380, 510, { name: "Judge", model: "neoproxy/heavy", question: "Is this mergeable?", labels: "yes,no,unsure" }),
  n("approve", "out.comment_pr", 20, 750, { name: "Approve", comment: "LGTM. The reviewers found no blocking defects." }),
  n("concerns", "out.comment_pr", 380, 750, { name: "Request changes", comment: "Post the reviewers' concrete concerns." }),
  n("owner", "out.message_thread", 740, 750, { name: "Ask the owner", thread: "PR review decisions" }),
 ], [e("pr", "sonnet", "event"), e("pr", "sol", "event"), e("pr", "grok", "event"), e("sonnet", "merge", "text", "a"), e("sol", "merge", "text", "b"), e("grok", "merge", "text", "c"), e("merge", "judge", "merged"), e("judge", "approve", "yes"), e("judge", "concerns", "no"), e("judge", "owner", "unsure")], { trigger: "PR opened in office/atlas" }),
 fixture("p_inbox", [
  n("capture", "event.inbox_captured", 420, 0, { name: "Inbox captured" }), n("tidy", "infer.tidy", 420, 170, { name: "Clean up", model: "neoproxy/small", prompt: "Clean this up without losing meaning." }), n("kind", "route.classify", 420, 340, { name: "Choose destination", model: "neoproxy/small", question: "What kind of item is this?", labels: "ticket,idea,decision,investigation" }),
  n("issue", "out.file_issue", 0, 600, { name: "File a defect", repository: "office/atlas" }), n("card", "out.create_card", 300, 600, { name: "Park the idea", board: "atlas/backlog" }), n("note", "out.write_note", 600, 600, { name: "Record a decision", path: "decisions/" }), n("thread", "out.message_thread", 900, 600, { name: "Investigate", thread: "Inbox investigations" }),
 ], [e("capture", "tidy", "event"), e("tidy", "kind", "text"), e("kind", "issue", "ticket"), e("kind", "card", "idea"), e("kind", "note", "decision"), e("kind", "thread", "investigation")], { trigger: "Inbox captured" }),
 fixture("r_heavy", [n("entry", "router.entry", 0, 140, { name: "Request", virtualModel: "neoproxy/heavy" }), n("astra", "router.stage", 370, 140, { name: "Astra", model: "neoproxy/codex/gpt-6-astra", accounts: "all", accountCount: 3, draw: "alternate", perAccount: 5, cap: 15, per: "user", window: "week", effort: "" }), n("sol", "router.stage", 740, 140, { name: "Sol", model: "neoproxy/codex/gpt-6.1-sol", accounts: "all", accountCount: 3, draw: "alternate", perAccount: 20, cap: 20, per: "user", window: "week", effort: "" }), n("limit", "router.terminal", 1110, 140, { name: "Weekly limit", kind: "limit", message: "You've used your heavy share this week." })], [e("entry", "astra", "request", "request"), e("astra", "sol", "next", "request"), e("sol", "limit", "next", "request")], { virtualModel: "neoproxy/heavy", message: "You've used your heavy share this week." }),
 fixture("r_default", [n("entry", "router.entry", 0, 140, { name: "Request", virtualModel: "neoproxy/default" }), n("sonnet", "router.stage", 370, 140, { name: "Sonnet", model: "neoproxy/anthropic/claude-sonnet-5-5", accounts: "all", accountCount: 2, draw: "alternate", perAccount: 10, cap: 10, per: "user", window: "week" }), n("luna", "router.stage", 740, 140, { name: "Luna", model: "neoproxy/codex/gpt-6-luna", accounts: "all", accountCount: 3, draw: "least-used", perAccount: 10, cap: 10, per: "user", window: "week" }), n("limit", "router.terminal", 1110, 140, { name: "Limit", kind: "limit", message: "Your default share is used for this week." })], [e("entry", "sonnet", "request", "request"), e("sonnet", "luna", "next", "request"), e("luna", "limit", "next", "request")], { virtualModel: "neoproxy/default" }),
 fixture("c_kind", [n("input", "cls.input", 380, 0, { name: "Inbox text", sample: "The docs search returns a 404." }), n("ask", "cls.ask", 380, 170, { name: "Inbox kind", model: "neoproxy/small", question: "Is this a defect, an idea, a decision or a question?", labels: "defect,idea,decision,question" }), ...["defect", "idea", "decision", "question", "unsure"].map((label, i) => n(label, "cls.output", i * 300, 480, { name: label, label }))], [e("input", "ask", "text", "text"), ...["defect", "idea", "decision", "question", "unsure"].map(label => e("ask", label, label))], { question: "Is this a defect, an idea, a decision or a question?" }),
 fixture("b_wheel", [n("backlog", "bf.column", 380, 0, { name: "Backlog", column: "backlog" }), n("worker", "bf.assign", 380, 160, { name: "Assign Worker", template: "Worker", model: "neoproxy/heavy" }), n("pr", "bf.gate", 380, 330, { name: "PR opened?", condition: "PR opened" }), n("review", "bf.column", 180, 550, { name: "Review", column: "review" }), n("passed", "bf.gate", 180, 710, { name: "Review passed?", condition: "review passed" }), n("done", "bf.done", 180, 930, { name: "Done" }), n("notify", "bf.notify", 620, 710, { name: "Needs the owner", who: "Shay" })], [e("backlog", "worker"), e("worker", "pr"), e("pr", "review", "yes"), e("pr", "notify", "no"), e("review", "passed"), e("passed", "done", "yes"), e("passed", "notify", "no")], { board: "atlas", project: "atlas" }),
];
const storageKey = "neodeck.studio.graphs.v1";
function loadGraphs(): StudioGraph[] { try { const raw = localStorage.getItem(storageKey); if (raw) return JSON.parse(raw) as StudioGraph[]; } catch { /* Browser storage can be unavailable. The in-memory editor still works. */ } return structuredClone(fixtures); }
let graphs = loadGraphs();
function persist(): void { try { localStorage.setItem(storageKey, JSON.stringify(graphs)); } catch { /* In-memory preview remains available. */ } }
function previewRun(graph: StudioGraph, at: number, ok = true): StudioRun {
 const starts = new Map<string, number>();
 const results: StudioRun["nodes"] = [];
 const remaining = [...graph.nodes];
 for (let round = 0; remaining.length && round <= graph.nodes.length; round++) {
  for (let i = 0; i < remaining.length;) {
   const node = remaining[i]!;
   const upstream = graph.edges.filter(edge => edge.to.node === node.id).map(edge => edge.from.node);
   if (upstream.some(id => !starts.has(id))) { i++; continue; }
   const start = Math.max(at, ...upstream.map(id => starts.get(id)!));
   const duration = node.type.startsWith("infer") ? 17_000 + results.length * 2900 : node.type.includes("classify") || node.type === "cls.ask" ? 5200 : 500;
   const end = start + duration;
   starts.set(node.id, end);
   results.push({ nodeId: node.id, startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), status: ok ? "ok" : node.id === "judge" ? "failed" : "ok", note: node.id === "judge" ? (ok ? "yes: no blocking defects" : "Classifier request timed out") : "Preview execution, no external actions sent." });
   remaining.splice(i, 1);
  }
 }
 for (const node of remaining) results.push({ nodeId: node.id, startedAt: new Date(at).toISOString(), status: "skipped", note: "Not reachable in the preview walk." });
 return { id: crypto.randomUUID(), graphId: graph.id, startedAt: new Date(at).toISOString(), endedAt: new Date(Math.max(at, ...starts.values())).toISOString(), ok, trigger: "PR opened", costUsd: 0.142, nodes: results };
}
const runStore = [previewRun(fixtures[0]!, now - 95 * 60_000), previewRun(fixtures[0]!, now - 210 * 60_000, false), previewRun(fixtures[1]!, now - 3 * 60_000)];
const preview: StudioClient = {
 async list() { return graphs.map(({ nodes, edges: _edges, settings: _settings, updatedAt: _updatedAt, ...g }) => ({ ...structuredClone(g), nodes: nodes.length })); },
 async get(id) { const graph = graphs.find(g => g.id === id || g.name === id); if (!graph) throw new Error("Graph not found. Choose one from the list."); return structuredClone(graph); },
 async save(graph) { const saved = structuredClone({ ...graph, updatedAt: new Date().toISOString() }); graphs = [...graphs.filter(g => g.id !== graph.id), saved]; persist(); return structuredClone(saved); },
 async create(kind, name) { const graph: StudioGraph = { id: crypto.randomUUID(), kind, name, description: "", enabled: false, nodes: [], edges: [], settings: {}, updatedAt: new Date().toISOString() }; return this.save(graph); },
 async remove(id) { graphs = graphs.filter(g => g.id !== id); persist(); },
 async setEnabled(id, enabled) { const graph = await this.get(id); await this.save({ ...graph, enabled }); },
 async run(id) { const graph = await this.get(id); const problems = graphProblems(graph); if (problems.length) throw new Error(problems[0]!.message); const run = previewRun(graph, Date.now()); run.trigger = "Manual preview"; runStore.unshift(run); await this.save({ ...graph, lastRun: { at: run.startedAt, ok: true } }); return structuredClone(run); },
 async runs(id) { return structuredClone(runStore.filter(run => run.graphId === id)); },
};
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`/api/graphs${path}`, { ...init, headers: { "content-type": "application/json" } }); if (!response.ok) throw new Error(`Graph request failed (${response.status}). Try again.`); return response.json() as Promise<T>; }
const liveGraphs: StudioClient = {
 list: () => request<GraphSummary[]>(""), get: id => request(`/${encodeURIComponent(id)}`), save: graph => request(`/${encodeURIComponent(graph.id)}`, { method: "PUT", body: JSON.stringify(graph) }), create: (kind, name) => request("", { method: "POST", body: JSON.stringify({ kind, name }) }), remove: async id => { await request(`/${encodeURIComponent(id)}`, { method: "DELETE" }); }, setEnabled: async (id, enabled) => { const graph = await liveGraphs.get(id); await liveGraphs.save({ ...graph, enabled }); }, run: id => request(`/${encodeURIComponent(id)}/run`, { method: "POST" }), runs: id => request(`/${encodeURIComponent(id)}/runs`),
};
const graphClient = SOURCES.studioGraphs === "live" ? liveGraphs : preview;
const live: StudioClient = {
 ...graphClient,
 async list() { const [routineResult, previewGraphs] = await Promise.all([routinesApi.list(), graphClient.list()]); return [...routineResult.routines.map(r => ({ id: r.id, kind: "flow" as const, name: r.name, description: r.description, nodes: 0, enabled: r.enabled, ...(r.lastRunAt ? { lastRun: { at: r.lastRunAt, ok: true } } : {}) })), ...previewGraphs, { id: "map", kind: "map" as const, name: "Knowledge map", description: "Every note and the links between them", nodes: 0, enabled: true }]; },
 async setEnabled(id, enabled) { const list = await this.list(); if (list.find(g => g.id === id)?.kind === "flow") await routinesApi.update(id, { enabled }); else await graphClient.setEnabled(id, enabled); },
 async remove(id) { const list = await this.list(); if (list.find(g => g.id === id)?.kind === "flow") await routinesApi.remove(id); else await graphClient.remove(id); },
 async run(id) { const list = await this.list(); if (list.find(g => g.id === id)?.kind !== "flow") return graphClient.run(id); await routinesApi.runNow(id); return { id: "queued", graphId: id, startedAt: new Date().toISOString(), ok: null, trigger: "Manual", nodes: [] }; },
 async runs(id) { const list = await this.list(); if (list.find(g => g.id === id)?.kind !== "flow") return graphClient.runs(id); const { runs } = await routinesApi.runs(id); return Promise.all(runs.map(async run => { const { steps } = await routinesApi.steps(id, run.id); return { id: run.id, graphId: id, startedAt: run.startedAt, endedAt: run.endedAt, ok: !run.endedAt && !run.abortedAt ? null : !run.error && !run.abortReason && !run.stepCountFailed, trigger: run.trigger, costUsd: run.totalLlmCostMicros / 1_000_000, nodes: steps.map(s => ({ nodeId: s.stepId, startedAt: s.startedAt, endedAt: s.endedAt, status: s.status === "success" ? "ok" as const : s.status === "failed" || s.status === "aborted" ? "failed" as const : s.status === "running" ? "running" as const : "skipped" as const, note: s.error ?? s.stdoutExcerpt })) }; })); },
};
export const studio: StudioClient = SOURCES.studio === "live" ? live : preview;
