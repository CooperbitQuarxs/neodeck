import "./threads.css";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, MessagesSquare, MoreHorizontal, Plus } from "lucide-react";
import { Dot, Empty, ErrorState, NeoBadge, NeoButton, NeoSelect, PageHeader, SearchInput, Segmented, formatShortRelative } from "@/components/neo";
import { ExtUiDialog } from "@/components/chat/ExtUiDialog";
import { api } from "@/lib/api";
import { initSession } from "@/lib/reducer";
import { useStore } from "@/lib/store";
import { tasksApi } from "@/lib/tasks-api";
import { formatCost, formatTokens } from "@/lib/utils";
import { shortPick } from "../client/models";
import { threads, useThreadsRevision, type ThreadMessage, type ThreadSummary, type ThreadTranscript } from "../client/threads";
import { AgentSwatch } from "../components/AgentSwatch";
import { ALL_TARGETS, Composer } from "../components/Composer";
import { PreviewChip } from "../components/PreviewChip";
import { ThreadSpawnAgentDrawer } from "../components/SpawnAgentDrawer";
import { NAV_ITEMS } from "../nav";
import { Transcript } from "./threads/Transcript";

const GROUPS = [{ state: "needs-you", label: "Needs you" }, { state: "working", label: "Working" }, { state: "settled", label: "Settled" }] as const;
const EMPTY_CHILDREN: ThreadTranscript = { messages: [], toolCalls: {} };
export function ThreadsPage() {
	const nav = NAV_ITEMS.find((item) => item.to === "/threads")!;
	const [params, setParams] = useSearchParams();
	const id = params.get("thread");
	const sessions = useStore((s) => s.sessions);
	const sessionsById = useStore((s) => s.sessionsById);
	const nodes = useStore((s) => s.subagentsBySession);
	const workspaces = useStore((s) => s.workspaces);
	const defaultCwd = useStore((s) => s.defaultCwd);
	const revision = useThreadsRevision();
	const [rows, setRows] = useState<ThreadSummary[]>([]);
	const [search, setSearch] = useState("");
	const [project, setProject] = useState("");
	const [error, setError] = useState<string>();
	const [loading, setLoading] = useState(false);
	const [creating, setCreating] = useState(false);
	const [cwd, setCwd] = useState("");
	const [spawn, setSpawn] = useState(false);
	const [targets, setTargets] = useState<Record<string, string>>({});
	const [mode, setMode] = useState<"prose" | "everything">("prose");
	const [depth, setDepth] = useState<"primaries" | "spawned">("primaries");
	const [children, setChildren] = useState<ThreadTranscript>(EMPTY_CHILDREN);
	const [editing, setEditing] = useState(false);
	const [title, setTitle] = useState("");
	const [menu, setMenu] = useState(false);
	const selected = rows.find((row) => row.id === id);
	const session = selected?.live && id ? sessionsById[id] : undefined;
	const mainAgents = selected?.agents.filter((a) => !a.spawnedBy) ?? [];
	const target = id ? targets[id] ?? "main" : "main";
	const targetAgent = mainAgents.find((a) => a.id === target) ?? mainAgents[0];
	const targeted = target === ALL_TARGETS ? mainAgents : mainAgents.filter((a) => a.id === target);
	const busy = target === ALL_TARGETS ? mainAgents.some((a) => a.state === "working") : targetAgent?.state === "working";
	const select = useCallback((next: string | null) => { setCreating(false); setEditing(false); setMenu(false); setError(undefined); setParams((previous) => { const p = new URLSearchParams(previous); if (next) p.set("thread", next); else p.delete("thread"); return p; }); }, [setParams]);
	const refresh = useCallback(async () => { try { setRows(await threads.list()); } catch (e) { setError(`Could not load threads. ${String(e)}`); } }, []);
	useEffect(() => { let cancelled = false; void threads.list().then((next) => { if (!cancelled) setRows(next); }, (e: unknown) => { if (!cancelled) setError(String(e)); }); return () => { cancelled = true; }; }, [sessions, sessionsById, nodes, revision]);
	useEffect(() => { setChildren(EMPTY_CHILDREN); if (depth !== "spawned" || !session) return; let cancelled = false; void Promise.all((nodes[session.sessionId] ?? []).filter((node) => node.sessionFile).map(async (node) => { const response = await api.getSubagentTranscript(session.sessionId, node.id); const ui = initSession({ sessionId: node.id, cwd: session.cwd, isStreaming: false, messages: response.messages, todoPhases: [] }); return { messages: ui.messages.map((m) => ({ ...m, agentId: node.id })), toolCalls: ui.toolCalls }; })).then((parts) => { if (!cancelled) setChildren({ messages: parts.flatMap((part) => part.messages), toolCalls: Object.assign({}, ...parts.map((part) => part.toolCalls)) as ThreadTranscript["toolCalls"] }); }, (e: unknown) => { if (!cancelled) setError(`Could not load spawned agents. ${String(e)}`); }); return () => { cancelled = true; }; }, [depth, id, nodes]);
	const openRequest = useRef(0);
	useEffect(() => {
		if (!selected?.live || !id) return;
		const request = ++openRequest.current;
		if (sessionsById[id]) { useStore.getState().selectSession(id); return; }
		if (!selected.sessionPath) return;
		setLoading(true);
		void useStore.getState().openTranscript(selected.sessionPath).then(() => { if (request !== openRequest.current) return; const opened = useStore.getState().activeId; if (opened && opened !== id) select(opened); }, (e: unknown) => { if (request === openRequest.current) setError(`Could not open this thread. ${String(e)}`); }).finally(() => { if (request === openRequest.current) setLoading(false); });
		return () => { openRequest.current++; };
	}, [id, selected?.live, selected?.sessionPath]);
	const filterHandled = useRef(false);
	useEffect(() => { if (params.get("filter") !== "needs-you") { filterHandled.current = false; return; } if (!filterHandled.current && rows.length) { const first = rows.find((r) => r.state === "needs-you"); if (first) select(first.id); filterHandled.current = true; } }, [params, rows, select]);
	const cardHandled = useRef<string>();
	useEffect(() => { const card = params.get("card"); if (!card || cardHandled.current === card || !defaultCwd) return; cardHandled.current = card; void (async () => { const existingId = localStorage.getItem(`neodeck.card-thread.${card}`); if (existingId && rows.some((row) => row.id === existingId)) { select(existingId); return; } try { setLoading(true); const result = await tasksApi.list(); const task = result.tasks.find((item) => `T-${item.displayId}` === card || item.id === card); if (!task) throw new Error(`Card ${card} was not found. Open the card on the Board and try again.`); const next = await useStore.getState().createSession({ cwd: task.cwd || defaultCwd }); await useStore.getState().renameSession(next, task.title); localStorage.setItem(`neodeck.card-thread.${card}`, next); await refresh(); select(next); } catch (e) { setError(`Could not open the card's thread. ${String(e)}`); } finally { setLoading(false); } })(); }, [params, defaultCwd, rows, refresh, select]);
	const projects = useMemo(() => [...new Set([...workspaces.map((w) => w.cwd), ...rows.flatMap((r) => r.project ? [r.project] : [])])], [rows, workspaces]);
	function projectLabel(value?: string): string { return workspaces.find((w) => w.cwd === value)?.label || value?.split("/").filter(Boolean).at(-1) || "No project"; }
	const visible = rows.filter((row) => (!project || row.project === project) && row.title.toLowerCase().includes(search.toLowerCase()));
	const previewTranscript = id ? threads.transcript(id) : EMPTY_CHILDREN;
	const transcript = useMemo(() => { const base: ThreadMessage[] = session?.messages ?? previewTranscript.messages; const extras = selected?.live ? previewTranscript.messages : []; const merged = [...base, ...extras, ...(depth === "spawned" ? children.messages : [])]; if (depth === "spawned" && children.messages.length) merged.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)); return merged.filter((m) => depth === "spawned" || !selected?.agents.find((a) => a.id === m.agentId)?.spawnedBy); }, [session?.messages, previewTranscript.messages, children.messages, depth, selected]);
	const usage = transcript.reduce((sum, m) => m.role === "assistant" ? { cost: sum.cost + (m.usage?.cost ?? 0), tokens: sum.tokens + (m.usage?.totalTokens ?? 0) } : sum, { cost: 0, tokens: 0 });
	async function run(action: () => Promise<void>): Promise<void> { setError(undefined); try { await action(); } catch (e) { setError(String(e)); } }
	async function start(): Promise<void> { setLoading(true); await run(async () => { const next = await useStore.getState().createSession({ cwd: cwd || defaultCwd }); await refresh(); select(next); }); setLoading(false); }
	async function rename(): Promise<void> { if (!id || !title.trim()) return; await run(async () => { await threads.rename(id, title.trim()); setEditing(false); await refresh(); }); }
	function startRename(): void { setTitle(selected?.title ?? ""); setEditing(true); setMenu(false); }
	async function send(text: string): Promise<void> {
		if (!selected || !id) return;
		await run(async () => {
			const ids = targeted.map((a) => a.id);
			if (selected.live && ids.includes("main")) { const next = await useStore.getState().resumeSession(id); useStore.getState().selectSession(next); useStore.getState().sendPrompt(text, undefined, next); if (next !== id) select(next); }
			const previewIds = selected.live ? ids.filter((agentId) => agentId !== "main") : ids;
			if (previewIds.length) threads.send(id, previewIds, text);
		});
	}
	return <div className="neo-fill neo-threads"><PageHeader title={nav.label} description={nav.blurb} badge={<PreviewChip domains={["threadAgents"]} />} actions={<NeoButton variant="primary" onClick={() => { setCreating(true); setError(undefined); }}><Plus size={14} />New thread</NeoButton>} />
		<div className="neo-split neo-fill-body" style={{ "--split-w": "300px" } as CSSProperties}>
			<aside className="neo-split-list"><div className="neo-split-list-head"><SearchInput value={search} onChange={setSearch} placeholder="Search threads" aria-label="Search threads" size="sm" /><NeoSelect value={project} onChange={(e) => setProject(e.target.value)} aria-label="Filter threads by project" size="sm"><option value="">All projects</option>{projects.map((value) => <option key={value} value={value}>{projectLabel(value)}</option>)}</NeoSelect></div><div className="neo-split-rows" onKeyDown={(e) => { if (!["ArrowDown", "ArrowUp", "j", "k"].includes(e.key) || !(e.target instanceof HTMLButtonElement)) return; const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(".neo-row")); const i = buttons.indexOf(e.target); const next = buttons[i + (e.key === "ArrowDown" || e.key === "j" ? 1 : -1)]; if (next) { e.preventDefault(); next.focus(); next.click(); } }}>
				{GROUPS.map((group) => { const items = visible.filter((row) => row.state === group.state).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); return items.length ? <section key={group.state} aria-label={group.label}><div className="neo-split-group">{group.label}<span className="neo-num">{items.length}</span></div>{items.map((row) => <button key={row.id} type="button" className="neo-row" data-active={row.id === id && !creating} data-settled={row.state === "settled"} data-state={row.state} title={row.title} onClick={() => select(row.id)}><span className="neo-row-lead"><Dot tone={row.state === "needs-you" ? "accent" : row.state === "working" ? "live" : undefined} pulse={row.state !== "settled"} /></span><span className="neo-row-title">{row.title}</span><span className="neo-row-when">{formatShortRelative(row.updatedAt)}</span><span className="neo-row-sub">{projectLabel(row.project)}<span>·</span><span className="neo-threads-mini-agents">{row.agents.filter((a) => !a.spawnedBy).slice(0, 3).map((a) => <AgentSwatch key={a.id} hue={a.hue} size={8} />)}</span><span>{row.agents.filter((a) => !a.spawnedBy).length} {row.agents.filter((a) => !a.spawnedBy).length === 1 ? "agent" : "agents"}</span>{row.live ? <span className="neo-threads-live-label">session</span> : null}</span></button>)}</section> : null; })}
				{visible.length === 0 ? <Empty title="No threads match" hint="Clear the search or choose another project." /> : null}
			</div></aside>
			<section className="neo-split-detail">{error ? <ErrorState error={error} onRetry={() => void refresh()} /> : null}
				{creating ? <div className="neo-threads-new"><MessagesSquare size={24} /><h2>Start a thread</h2><p>Choose the project Main will work in.</p><NeoSelect value={cwd} aria-label="New thread project" onChange={(e) => setCwd(e.target.value)}><option value="">{projectLabel(defaultCwd)} (default)</option>{workspaces.filter((w) => w.cwd !== defaultCwd).map((w) => <option key={w.cwd} value={w.cwd}>{w.label}</option>)}</NeoSelect><div className="flex gap-2"><NeoButton variant="primary" disabled={loading || !(cwd || defaultCwd)} onClick={() => void start()}>{loading ? "Starting…" : "Start"}</NeoButton><NeoButton variant="ghost" onClick={() => setCreating(false)}>Cancel</NeoButton></div></div> : selected ? <>
					<header className="neo-threads-head">{editing ? <form onSubmit={(e) => { e.preventDefault(); void rename(); }} className="neo-threads-rename"><input className="neo-input" aria-label="Thread title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }} /><NeoButton icon size="sm" type="submit" aria-label="Save thread title"><Check size={13} /></NeoButton></form> : <button type="button" className="neo-threads-title" title="Rename thread" onClick={startRename}>{selected.title}</button>}<div className="neo-threads-head-meta"><NeoBadge>{projectLabel(selected.project)}</NeoBadge><span>{mainAgents.length} {mainAgents.length === 1 ? "agent" : "agents"}</span><span className="neo-num">{formatCost(usage.cost)}</span><span className="neo-num">{formatTokens(usage.tokens)} tok</span></div><NeoButton variant="ghost" size="sm" onClick={() => threads.settle(selected.id, selected.state !== "settled")}>{selected.state === "settled" ? "Reopen" : "Settle"}</NeoButton><div className="neo-threads-menu-anchor"><NeoButton variant="ghost" size="sm" icon aria-label="Thread actions" aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreHorizontal size={16} /></NeoButton>{menu ? <><button className="neo-threads-menu-scrim" aria-label="Close thread actions" onClick={() => setMenu(false)} /><div className="neo-menu" role="menu" onKeyDown={(e) => { if (e.key === "Escape") setMenu(false); }}><button type="button" role="menuitem" className="neo-menu-item" onClick={startRename}>Rename</button>{selected.live ? <Link to="/legacy/chat" role="menuitem" className="neo-menu-item">Open in legacy chat</Link> : null}<button type="button" role="menuitem" className="neo-menu-item neo-threads-danger" onClick={() => void run(async () => { await threads.dispose(selected.id); setMenu(false); select(null); await refresh(); })}>Dispose</button></div></> : null}</div></header>
					<div className="neo-threads-agent-strip"><div className="neo-threads-agent-chips">{mainAgents.map((agent) => <button type="button" key={agent.id} className="neo-chip-btn neo-threads-agent-chip" data-on={target === agent.id} onClick={() => setTargets((previous) => ({ ...previous, [selected.id]: agent.id }))}><AgentSwatch hue={agent.hue} name={agent.name} /><span className="neo-mono neo-threads-agent-model">{shortPick(agent.model)}</span>{agent.state !== "idle" ? <Dot tone={agent.state === "needs-you" ? "accent" : "live"} pulse={agent.state === "working"} /> : null}</button>)}<NeoButton variant="ghost" size="sm" onClick={() => setSpawn(true)}><Plus size={12} />Agent</NeoButton></div><div className="neo-threads-view-controls"><Segmented label="Transcript view" value={mode} onChange={setMode} options={[{ value: "prose", label: "Prose" }, { value: "everything", label: "Everything" }]} /><span className="neo-threads-depth-label">Depth</span><Segmented label="Agent depth" value={depth} onChange={setDepth} options={[{ value: "primaries", label: "Primaries" }, { value: "spawned", label: "+ spawned" }]} /></div></div>
					{loading ? <p className="neo-thread-aside">Opening transcript…</p> : <Transcript key={selected.id} messages={transcript} agents={selected.agents} toolCalls={{ ...(session?.toolCalls ?? previewTranscript.toolCalls), ...children.toolCalls }} everything={mode === "everything"} session={session} />}
					{session?.lastError ? <p className="neo-threads-error neo-threads-session-error" role="alert">{session.lastError}</p> : null}
					<Composer key={selected.id} targets={mainAgents} targetId={target} onTargetChange={(next) => setTargets((previous) => ({ ...previous, [selected.id]: next }))} model={targetAgent?.model ?? "neoproxy/default"} onModelChange={(model) => void run(async () => { await Promise.all(targeted.map((agent) => threads.setModel(selected.id, agent.id, model))); })} onSend={send} busy={busy} onStop={() => { if (selected.live && targeted.some((a) => a.id === "main")) { useStore.getState().selectSession(selected.id); useStore.getState().abort(); } threads.stop(selected.id, targeted.map((a) => a.id)); }} disabled={loading} draft={params.get("draft") ?? undefined} />
					<ThreadSpawnAgentDrawer open={spawn} onClose={() => setSpawn(false)} agents={selected.agents} live={selected.live} onSpawn={async (input) => { const added = await threads.addAgent(selected.id, input); setTargets((previous) => ({ ...previous, [selected.id]: added.id })); }} />
				</> : <div className="neo-threads-empty"><Empty icon={MessagesSquare} title="Pick a thread, or start one" hint="Your agents and their conversation share one place. Open a thread on the left to continue." action={<NeoButton variant="primary" onClick={() => setCreating(true)}><Plus size={14} />New thread</NeoButton>} /></div>}
			</section>
		</div>{selected?.live ? <ExtUiDialog /> : null}
	</div>;
}
