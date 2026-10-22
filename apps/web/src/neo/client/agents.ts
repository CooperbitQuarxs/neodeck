/** Agents and templates use in-memory contracts until /api/agents lands.
 * Live sessions, spawned workers and advisor rosters are merged, never seeded.
 */
import { api } from "@/lib/api";
import { advisorsApi, type LiveAdvisorStatus, type SessionAdvisorRoster } from "@/lib/advisors-api";
import { useStore } from "@/lib/store";
import { tasksApi } from "@/lib/tasks-api";
import { auth } from "./auth";
import { PREVIEW_AGENTS, PREVIEW_JUDGE, PREVIEW_TEMPLATES, type AgentTemplate as PreviewTemplate, type AgentState, type JudgeEvent, type LiveAgent, type Restriction } from "./preview-data";
import { SOURCES } from "./source";
export type { AgentTemplate, AgentTemplateInput, AgentInstance, AgentCapabilities } from "@npi-deck/protocol";
import type { AgentTemplate as PersistedTemplate, AgentTemplateInput, AgentInstance, AgentCapabilities } from "@npi-deck/protocol";

async function request<T>(route: string, method = "GET", body?: unknown): Promise<T> {
 const response = await fetch(`/api${route}`, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
 if (!response.ok) {
  const details = await response.json().catch(() => ({})) as { error?: string };
  throw new Error(details.error ?? `HTTP ${response.status}`);
 }
 return await response.json() as T;
}

/** Native instances only. An unavailable action is never simulated locally. */
export const agentInstances = {
 list: async () => (await request<{ instances: AgentInstance[] }>("/agents/instances")).instances,
 forThread: async (id: string) => (await request<{ agents: AgentInstance[] }>(`/threads/${encodeURIComponent(id)}/agents`)).agents,
 steer: async (id: string, text: string): Promise<void> => { await request(`/agents/instances/${encodeURIComponent(id)}/steer`, "POST", { text }); },
 cancel: async (id: string): Promise<void> => { await request(`/agents/instances/${encodeURIComponent(id)}/cancel`, "POST"); },
 setModel: async (id: string, model: string): Promise<void> => { await request(`/agents/instances/${encodeURIComponent(id)}`, "PATCH", { model }); },
 capabilities: () => request<AgentCapabilities>("/agents/capabilities"),
};
/** Deck-authored definitions persist in SQLite. This is not native discovery. */
export const agentTemplates = {
 list: async () => (await request<{ templates: PersistedTemplate[] }>("/agents/templates")).templates,
 save: (template: AgentTemplateInput) => request<PersistedTemplate>(`/agents/templates/${encodeURIComponent(template.id)}`, "PUT", template),
 remove: async (id: string): Promise<void> => { await request(`/agents/templates/${encodeURIComponent(id)}`, "DELETE"); },
};
/** Thread transport exposes only actions backed by the attached native runtime. */
export const threadAgents = {
 list: agentInstances.forThread,
 send: async (id: string, to: string, text: string): Promise<void> => { await request(`/threads/${encodeURIComponent(id)}/send`, "POST", { to, text }); },
 remove: async (id: string, agentId: string): Promise<void> => { await request(`/threads/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}`, "DELETE"); },
 setModel: async (id: string, agentId: string, model: string): Promise<void> => { await request(`/threads/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}`, "PATCH", { model }); },
};
export const judgeClient = {
 status: () => request<{ available: false; reason: string }>("/judge"),
 events: async (limit = 50) => (await request<{ events: JudgeEvent[]; available: boolean; reason: string }>(`/judge/events?limit=${encodeURIComponent(limit)}`)).events,
 undoStop: async (id: string): Promise<void> => { await request(`/judge/events/${encodeURIComponent(id)}/undo`, "POST"); },
};

/** A destination offered by the spawn form. Empty thread id creates a preview thread. */
export interface WhereOption { kind: LiveAgent["where"]["kind"]; id: string; label: string }
/** POST /api/agents: template restrictions can be loosened before spawning. */
export interface SpawnAgentInput { template: string; name: string; hue: number; model: string; restrictions: Restriction[]; where: Pick<WhereOption, "kind" | "id"> }
/** Roster detail, including effective restrictions and live activity when available. */
export interface AgentRecord extends LiveAgent { restrictions: readonly Restriction[]; turns?: number; activity?: string; sessionId?: string; runtimeId?: string; runtimeKind?: "main" | "worker" | "advisor" }
export interface AgentsClient {
 roster(): Promise<AgentRecord[]>;
 templates(): Promise<PreviewTemplate[]>; saveTemplate(template: PreviewTemplate): Promise<PreviewTemplate>; removeTemplate(id: string): Promise<void>;
 spawn(input: SpawnAgentInput): Promise<AgentRecord>; stop(id: string): Promise<void>; setModel(id: string, model: string): Promise<void>; setRestrictions(id: string, restrictions: Restriction[]): Promise<void>;
 judge(opts?: { limit?: number }): Promise<JudgeEvent[]>; judgeUndoStop(eventId: string): Promise<void>; judgePaused(): boolean; setJudgePaused(value: boolean): void;
 destinations(): Promise<WhereOption[]>;
}
let templates = PREVIEW_TEMPLATES.map(t => ({ ...t, restrictions: [...t.restrictions] }));
let roster: AgentRecord[] = PREVIEW_AGENTS.map(a => ({ ...a, restrictions: [...(templates.find(t => t.id === a.template)?.restrictions ?? [])] }));
const local = new Map<string, Partial<AgentRecord>>();
let paused = false;
const undone = new Set<string>();
const started = new Date().toISOString();
const stateFor = (status: string): AgentState => /done|completed|aborted|cancelled|error|failed/.test(status) ? "done" : /park|wait|yield/.test(status) ? "parked" : /running|working|streaming/.test(status) ? "working" : "idle";

interface AdvisorSnapshot {
 version: string;
 roster: SessionAdvisorRoster | null;
 status: LiveAdvisorStatus | null;
}
const advisorCache = new Map<string, AdvisorSnapshot>();
const listeners = new Set<() => void>();
/** Advisor HTTP reads must not delay websocket-driven presence. */
export function subscribeAgents(listener: () => void): () => void {
 listeners.add(listener);
 return () => { listeners.delete(listener); };
}
function readAdvisors(id: string, version: string): AdvisorSnapshot {
 const cached = advisorCache.get(id);
 if (cached?.version === version) return cached;
 const next: AdvisorSnapshot = { version, roster: cached?.roster ?? null, status: cached?.status ?? null };
 advisorCache.set(id, next);
 void Promise.all([advisorsApi.roster(id).catch(() => null), advisorsApi.status(id).catch(() => null)]).then(([roster, status]) => {
  if (advisorCache.get(id) !== next) return;
  next.roster = roster;
  next.status = status;
  for (const listener of listeners) listener();
 });
 return next;
}

async function liveRoster(): Promise<AgentRecord[]> {
 const store = useStore.getState();
 const owner = (await auth.me())?.handle ?? "admin";
 const rows: AgentRecord[] = [];
 for (const session of Object.values(store.sessionsById)) {
  if (session.readOnly || session.endedByRestart) continue;
  const summary = store.sessions.find(s => s.id === session.sessionId);
  const where: LiveAgent["where"] = { kind: "thread", id: session.sessionId, label: session.sessionName ?? summary?.title ?? "Untitled thread" };
  const model = session.model ? `${session.model.provider}/${session.model.id}` : "neoproxy/default";
  const since = summary?.createdAt ?? started;
  if (session.status !== "idle") rows.push({ id: `live:${session.sessionId}:main`, name: "Main", template: "blank", model, where, state: "working", owner, tokens: session.usage.totalTokens, costUsd: session.usage.cost, since, hue: 190, restrictions: [], turns: session.turnCount, activity: session.status, sessionId: session.sessionId, runtimeKind: "main" });
  for (const node of store.subagentsBySession[session.sessionId] ?? []) rows.push({ id: `live:${session.sessionId}:worker:${node.id}`, name: node.name, template: "worker", model, where, state: stateFor(node.status), owner, tokens: 0, costUsd: 0, since: new Date(node.createdAt).toISOString(), hue: 40, restrictions: templates.find(t => t.id === "worker")?.restrictions ?? [], activity: node.activity ?? node.description ?? node.status, sessionId: session.sessionId, runtimeId: node.id, runtimeKind: "worker" });
  const { roster: advisorRoster, status } = readAdvisors(session.sessionId, `${session.advisorActivity}:${session.turnCount}:${session.status}`);
  if (!advisorRoster?.advisors.length) continue;
  for (const advisor of advisorRoster.advisors) {
   const stat = status?.stats.advisors.find(a => a.name === advisor.name);
   const overview = status?.overview.advisors.find(a => a.name === advisor.name);
   rows.push({ id: `live:${session.sessionId}:advisor:${advisor.name}`, name: advisor.name, template: "advisor", model: stat?.model ? `${stat.model.provider}/${stat.model.id}` : advisor.model ?? model, where, state: overview?.status === "running" && !overview.yielded ? "working" : "idle", owner, tokens: stat?.tokens.total ?? 0, costUsd: stat?.cost ?? 0, since, hue: 300, restrictions: templates.find(t => t.id === "advisor")?.restrictions ?? [], activity: overview?.status ?? "idle", sessionId: session.sessionId, runtimeId: advisor.name, runtimeKind: "advisor" });
  }
 }
 return rows.map(row => ({ ...row, ...local.get(row.id) }));
}

const preview: AgentsClient = {
 async roster() { return [...roster, ...await liveRoster()]; },
 async templates() { return templates; },
 async saveTemplate(template) { const saved = { ...template, restrictions: [...template.restrictions] }; templates = [...templates.filter(t => t.id !== saved.id), saved]; return saved; },
 async removeTemplate(id) { templates = templates.filter(t => t.id !== id); },
 async destinations() {
  const store = useStore.getState();
  const cards = await tasksApi.list();
  const options: WhereOption[] = [ { kind: "thread", id: "", label: "A new thread" }, ...store.sessions.map(s => ({ kind: "thread" as const, id: s.id, label: s.title ?? "Untitled thread" })), ...cards.tasks.filter(t => t.run).map(t => ({ kind: "card" as const, id: t.id, label: `T-${t.displayId} ${t.title}` })), { kind: "routine", id: "judge", label: "Every session (watcher)" } ];
  for (const a of PREVIEW_AGENTS) if (!options.some(o => o.kind === a.where.kind && o.id === a.where.id)) options.splice(options.length - 1, 0, a.where);
  return options;
 },
 async spawn(input) {
  const owner = (await auth.me())?.handle ?? "admin";
  const destination = (await this.destinations()).find(w => w.kind === input.where.kind && w.id === input.where.id);
  const agent: AgentRecord = { ...input, id: `ag_${crypto.randomUUID()}`, where: { ...input.where, id: input.where.id || `preview_${crypto.randomUUID()}`, label: destination?.label ?? "A new thread" }, state: "working", owner, tokens: 0, costUsd: 0, since: new Date().toISOString(), restrictions: [...input.restrictions], turns: 0 };
  roster = [...roster, agent]; return agent;
 },
 async stop(id) {
  const row = (await this.roster()).find(a => a.id === id);
  if (!row) throw new Error("This agent is no longer on the deck. Refresh the roster.");
  if (row.sessionId) {
   if (row.runtimeKind === "main") await api.abortSession(row.sessionId);
   else if (row.runtimeKind === "worker" && row.runtimeId) await api.abortSubagent(row.sessionId, row.runtimeId);
   else if (row.runtimeKind === "advisor") { const status = await advisorsApi.status(row.sessionId); await advisorsApi.select(row.sessionId, status.selection.filter(name => name !== row.runtimeId)); }
   local.set(id, { ...local.get(id), state: "done", activity: "Stopped" });
  } else roster = roster.map(a => a.id === id ? { ...a, state: "done" } : a);
 },
 async setModel(id, model) {
  const row = (await this.roster()).find(a => a.id === id);
  if (row?.runtimeKind === "main" && row.sessionId) {
   const slash = model.indexOf("/");
   if (slash < 1) throw new Error("Choose a provider/model from the model picker.");
   await api.setSessionModel(row.sessionId, { provider: model.slice(0, slash), id: model.slice(slash + 1) });
  }
  if (id.startsWith("live:")) local.set(id, { ...local.get(id), model });
  else roster = roster.map(a => a.id === id ? { ...a, model } : a);
 },
 async setRestrictions(id, restrictions) {
  if (id.startsWith("live:")) local.set(id, { ...local.get(id), restrictions: [...restrictions] });
  else roster = roster.map(a => a.id === id ? { ...a, restrictions: [...restrictions] } : a);
 },
 async judge({ limit } = {}) { return [...PREVIEW_JUDGE].sort((a,b) => b.at.localeCompare(a.at)).slice(0, limit); },
 async judgeUndoStop(eventId) {
  if (undone.has(eventId)) return;
  const event = PREVIEW_JUDGE.find(e => e.id === eventId && e.tone === "bad");
  if (!event) throw new Error("That event did not stop an agent.");
  await this.spawn({ template: "worker", name: event.agent, hue: 40, model: "neoproxy/heavy", restrictions: [...(templates.find(t => t.id === "worker")?.restrictions ?? [])], where: { kind: "card", id: "T-5" } });
  undone.add(eventId);
 },
 judgePaused: () => paused,
 setJudgePaused(value) { paused = value; roster = roster.map(a => a.id === "ag_judge" ? { ...a, state: value ? "parked" : "working" } : a); },
};
// The live contribution is additive while templates, spawning and judge remain preview.
const live: AgentsClient = { ...preview, async roster() { return liveRoster(); } };
export const agents: AgentsClient = SOURCES.agents === "live" ? live : preview;
export const formatCost = (usd: number): string => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: usd > 0 && usd < 0.01 ? 4 : 2 }).format(usd);
export function agentLink(where: LiveAgent["where"]): string { return where.kind === "thread" ? `/threads?thread=${encodeURIComponent(where.id)}` : where.kind === "card" ? `/board?card=${encodeURIComponent(where.id)}` : `/studio?graph=${encodeURIComponent(where.id)}`; }
