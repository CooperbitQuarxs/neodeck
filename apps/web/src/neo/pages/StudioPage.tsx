import "./studio.css";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { BookOpen, ChevronDown, Play, Plus, Save, Workflow } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { KbGraphResponse, Routine } from "@npi-deck/protocol";
import { Check, Empty, ErrorState, NeoBadge, NeoButton, PageHeader, SearchInput, SectionLabel, Segmented, Switch } from "@/components/neo";
import { RoutineBuilder, type RoutineBuilderHandle, type RoutineBuilderState } from "@/components/routines/RoutineBuilder";
import { kbApi } from "@/lib/kb-api";
import { routinesApi } from "@/lib/routines-api";
import { useStore } from "@/lib/store";
import { studio, graphProblems, type GraphSummary, type StudioGraph } from "../client/studio";
import { KnowledgeMap, mapLegend } from "../components/KnowledgeMap";
import { PreviewChip } from "../components/PreviewChip";
import { NAV_ITEMS } from "../nav";
import { FlowInspector } from "./studio/FlowInspector";
import { GraphList } from "./studio/GraphList";
import { NodeInspector } from "./studio/NodeInspector";
import { RunsDrawer } from "./studio/RunsDrawer";
import { SourceView } from "./studio/SourceView";
import { StudioCanvas } from "./studio/StudioCanvas";
import { BUILDABLE_KINDS, KIND_LABELS, type BuildableKind } from "./studio/vocab";

type View = "canvas" | "source" | "runs";
const page = NAV_ITEMS.find(item => item.to === "/studio")!;
export function StudioPage() {
 const [params, setParams] = useSearchParams(); const navigate = useNavigate();
 const [graphs, setGraphs] = useState<GraphSummary[]>([]), [graph, setGraph] = useState<StudioGraph>();
 const [routine, setRoutine] = useState<Routine>(), [flowState, setFlowState] = useState<RoutineBuilderState>();
 const [map, setMap] = useState<KbGraphResponse>(), [search, setSearch] = useState(""), [mapSearch, setMapSearch] = useState("");
 const [hideOrphans, setHideOrphans] = useState(false), [selected, setSelected] = useState<string | null>(null);
 const [error, setError] = useState(""), [notice, setNotice] = useState(""), [dirty, setDirty] = useState(false), [sourcePending, setSourcePending] = useState(false);
 const [menu, setMenu] = useState(false), [busy, setBusy] = useState(false), [runRevision, setRunRevision] = useState(0), [loading, setLoading] = useState(true);
 const builder = useRef<RoutineBuilderHandle>(null); const menuRoot = useRef<HTMLDivElement>(null);
 const requested = params.get("graph") ?? "p_pr";
 const summary = graphs.find(item => item.id === requested || item.name === requested || item.kind === "router" && `neoproxy/${item.name}` === requested);
 const id = summary?.id ?? requested; const flow = summary?.kind === "flow" || id === "new-flow", isMap = id === "map";
 const wantedView = params.get("view"); const view: View = wantedView === "source" || wantedView === "runs" ? wantedView : "canvas";
 const kbCounter = useStore(state => state.kbChangeCounter);
 const refresh = useCallback(async () => { try { setGraphs(await studio.list()); } catch (reason) { setError(String(reason)); setLoading(false); } }, []);
 useEffect(() => { void refresh(); }, [refresh]);
 useEffect(() => {
  if (!summary && id !== "new-flow" && graphs.length === 0) return;
  let alive = true; setLoading(true); setGraph(undefined); setRoutine(undefined); setFlowState(undefined); setDirty(false); setSelected(null); setError(""); setNotice(""); setSourcePending(false);
  const load = async () => {
   try {
    if (isMap) { const data = await kbApi.graph(); if (alive) setMap(data); }
    else if (flow) { if (id !== "new-flow") { const data = await routinesApi.get(id); if (alive) setRoutine(data); } }
    else { const data = await studio.get(id); if (alive) setGraph(data); }
   } catch (reason) { if (alive) setError(String(reason)); }
   finally { if (alive) setLoading(false); }
  };
  void load(); return () => { alive = false; };
 }, [id, flow, isMap, graphs.length === 0]);
 useEffect(() => { if (isMap) void kbApi.graph().then(setMap).catch(reason => setError(String(reason))); }, [isMap, kbCounter]);
 useEffect(() => { if (!menu) return; const close = (event: MouseEvent) => { if (!menuRoot.current?.contains(event.target as Node)) setMenu(false); }; const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); }; document.addEventListener("mousedown", close); window.addEventListener("keydown", key); return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", key); }; }, [menu]);
 function open(next: string): void { setParams(previous => { const p = new URLSearchParams(previous); p.set("graph", next); p.delete("view"); p.delete("note"); return p; }); }
 function changeView(next: View): void { if (sourcePending && next !== "source") { setError("Apply the source edits before leaving Source."); return; } setError(""); setParams(previous => { const p = new URLSearchParams(previous); p.set("graph", id); if (next === "canvas") p.delete("view"); else p.set("view", next); return p; }); }
 function change(next: StudioGraph): void { setGraph(next); setDirty(true); setNotice(""); }
 async function create(kind: BuildableKind): Promise<void> {
  setMenu(false); if (kind === "flow") { open("new-flow"); return; }
  try { const count = graphs.filter(g => g.kind === kind).length + 1; const created = await studio.create(kind, `Untitled ${KIND_LABELS[kind].toLowerCase()} ${count}`); await refresh(); open(created.id); } catch (reason) { setError(String(reason)); }
 }
 async function save(): Promise<void> {
  setBusy(true); setError("");
  try { if (flow) await builder.current?.save(); else if (graph) { const problems = graphProblems(graph); if (problems.length) throw new Error(problems[0]!.message); const saved = await studio.save(graph); setGraph(saved); setDirty(false); setNotice("Graph saved in this browser."); await refresh(); } } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
 }
 async function toggle(enabled: boolean): Promise<void> {
  try { await studio.setEnabled(id, enabled); if (flow && routine) setRoutine({ ...routine, enabled }); if (graph) setGraph({ ...graph, enabled }); await refresh(); } catch (reason) { setError(String(reason)); }
 }
 async function run(): Promise<void> {
  setBusy(true); setError("");
  try { await studio.run(id); setNotice(flow ? "Run queued. The live runner will record its steps here." : "Preview run complete. No external actions were sent."); setRunRevision(value => value + 1); await refresh(); changeView("runs"); } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
 }
 async function remove(): Promise<void> { try { await studio.remove(id); await refresh(); open(graphs.find(g => g.id !== id && g.kind !== "map")?.id ?? "map"); } catch (reason) { setError(String(reason)); } }
 function savedRoutine(saved: Routine): void { setRoutine(saved); setNotice("Flow saved."); void refresh(); if (id === "new-flow") open(saved.id); }
 const title = flow ? flowState?.name ?? routine?.name ?? "New flow" : graph?.name ?? summary?.name ?? (isMap ? "Knowledge map" : loading ? "Loading graph" : "Graph unavailable");
 const unsaved = flow ? flowState?.dirty ?? false : dirty;
 const canSave = flow ? flowState?.canSave && (unsaved || id === "new-flow") : dirty && !sourcePending;
 return <div className="neo-fill neo-studio"><PageHeader title={page.label} description={page.blurb} badge={<PreviewChip domains={["studioGraphs"]} />} actions={<div ref={menuRoot} className="neo-studio-new"><NeoButton onClick={() => setMenu(value => !value)} aria-expanded={menu} aria-haspopup="menu"><Plus size={14} />New graph<ChevronDown size={12} /></NeoButton>{menu ? <div className="neo-menu" role="menu">{BUILDABLE_KINDS.map(kind => <button key={kind} type="button" role="menuitem" className="neo-menu-item" onClick={() => void create(kind)}>{KIND_LABELS[kind]}</button>)}</div> : null}</div>} />
 <div className="neo-split neo-fill-body neo-studio-layout" data-side="true" style={{ "--split-w": "260px", "--side-w": "320px" } as CSSProperties}>
 <GraphList graphs={graphs} selected={id} search={search} onSearch={setSearch} onSelect={open} />
 <section className="neo-split-detail"><header className="neo-studio-toolbar"><div className="neo-studio-title"><input className="neo-studio-name" aria-label="Graph name" value={title} readOnly={isMap || loading} title="Click to rename" onChange={event => { if (flow && flowState) builder.current?.updateSpec({ ...flowState.spec, name: event.target.value }); else if (graph) change({ ...graph, name: event.target.value }); }} /><NeoBadge>{KIND_LABELS[isMap ? "map" : flow ? "flow" : graph?.kind ?? "pipeline"]}</NeoBadge></div>
 {!isMap ? <><div className="neo-studio-enabled"><Switch checked={flow ? routine?.enabled ?? false : graph?.enabled ?? false} onChange={enabled => void toggle(enabled)} disabled={loading || id === "new-flow"} label="Graph enabled" /><span>{(flow ? routine?.enabled : graph?.enabled) ? "Enabled" : "Disabled"}</span></div><Segmented label="Graph view" value={view} onChange={changeView} options={[{ value: "canvas", label: "Canvas" }, { value: "source", label: "Source" }, { value: "runs", label: "Runs" }]} /><div className="neo-studio-toolbar-actions"><NeoButton size="sm" variant="ghost" onClick={() => void run()} disabled={busy || loading || id === "new-flow" || unsaved || sourcePending}><Play size={12} />Run now</NeoButton><NeoButton size="sm" variant="primary" onClick={() => void save()} disabled={!canSave || busy}><Save size={12} />Save</NeoButton></div></> : <span className="neo-studio-help">Read-only here</span>}
 </header>
 {error ? <ErrorState error={error} /> : null}{notice ? <div className="neo-studio-notice" role="status">{notice}</div> : null}
 <div className="neo-studio-view">{loading ? <Empty icon={Workflow} title="Loading graph" /> : isMap ? map ? <KnowledgeMap graph={map} focus={params.get("note") ?? undefined} query={mapSearch} hideOrphans={hideOrphans} onOpen={path => navigate(`/knowledge?note=${encodeURIComponent(path)}`)} /> : <Empty icon={BookOpen} title="The map is empty" hint="Write a note in Knowledge to start linking ideas." /> : flow ? <><div className="neo-studio-flow" style={{ display: view === "runs" ? "none" : "flex" }}><RoutineBuilder key={id} routine={routine} onSaved={savedRoutine} onError={setError} embedded view={view === "source" ? "source" : "canvas"} editorRef={builder} onStateChange={setFlowState} /></div>{view === "runs" ? <RunsDrawer key={id} graphId={id} refresh={runRevision} /> : null}</> : graph ? view === "canvas" ? <StudioCanvas key={id} graph={graph} selected={selected} onSelect={setSelected} onChange={change} /> : view === "source" ? <SourceView graph={graph} onChange={change} onPending={setSourcePending} /> : <RunsDrawer key={id} graphId={id} graph={graph} refresh={runRevision} /> : <Empty icon={Workflow} title="Choose a graph" hint="Open a graph from the list or create a new one." />}</div>
 {!isMap ? <div className="neo-studio-status"><span>{sourcePending ? "Source edits not applied" : unsaved ? "Unsaved changes" : "All changes saved"}</span><span>{flow ? "Live routine" : "Preview graph"}</span></div> : null}
 </section>
 <aside className="neo-split-side">{isMap ? <div className="neo-studio-inspector"><header className="neo-studio-inspector-head"><BookOpen size={14} /><h2>Knowledge map</h2><NeoBadge>Live</NeoBadge></header><div className="neo-studio-inspector-body"><SearchInput value={mapSearch} onChange={setMapSearch} placeholder="Search notes on the map" /><Check checked={hideOrphans} onChange={setHideOrphans}>Hide unlinked notes</Check><Link className="neo-btn" to="/knowledge">Open in Knowledge</Link><SectionLabel>Directories</SectionLabel>{map ? mapLegend(map).map(dir => <div className="neo-studio-legend" key={dir.name}><i style={{ background: dir.color }} /><span>{dir.name}</span><span className="neo-num">{dir.count}</span></div>) : null}<p className="neo-studio-help">Larger dots have more inbound links. Hover to follow a neighbourhood. Click a note to read it in Knowledge.</p></div></div> : flow ? <FlowInspector spec={flowState?.spec} onChange={spec => builder.current?.updateSpec(spec)} /> : graph ? <NodeInspector graph={graph} node={graph.nodes.find(node => node.id === selected)} onChange={change} onDelete={nodeId => { change({ ...graph, nodes: graph.nodes.filter(n => n.id !== nodeId), edges: graph.edges.filter(e => e.from.node !== nodeId && e.to.node !== nodeId) }); setSelected(null); }} onDeleteGraph={() => void remove()} /> : null}</aside>
 </div></div>;
}
