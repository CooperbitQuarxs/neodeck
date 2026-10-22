import "./studio.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, History, Map as MapIcon, Play, Save, SlidersHorizontal, Workflow } from "lucide-react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { KbGraphResponse, Routine } from "@npi-deck/protocol";
import { Check, Empty, ErrorState, NeoButton, SearchInput, Segmented, Switch } from "@/components/neo";
import { RoutineBuilder, type RoutineBuilderHandle, type RoutineBuilderState } from "@/components/routines/RoutineBuilder";
import { kbApi } from "@/lib/kb-api";
import { routinesApi } from "@/lib/routines-api";
import { useStore } from "@/lib/store";
import { studio, graphProblems, StudioRequestError, type GraphKind, type GraphSummary, type StudioGraph, type StudioRun } from "../client/studio";
import { SOURCES } from "../client/source";
import { KnowledgeMap, mapLegend } from "../components/KnowledgeMap";
import { PreviewChip } from "../components/PreviewChip";
import { FlowInspector } from "./studio/FlowInspector";
import { GraphSettings, NodeInspector } from "./studio/NodeInspector";
import { RunsPanel } from "./studio/RunsPanel";
import { StudioIndex, studioPath, KIND_ICONS } from "./studio/StudioIndex";
import { SourceView } from "./studio/SourceView";
import { StudioCanvas, type NodeRunState } from "./studio/StudioCanvas";
import { KIND_LABELS, type BuildableKind } from "./studio/vocab";

type View = "canvas" | "source";
type Panel = "settings" | "runs" | null;

/**
 * Studio is a list page and a detail page. The old layout kept a graph list,
 * the canvas and an inspector in one panel, modelled on an IDE with everything
 * always in view, and the canvas got what was left. A graph editor needs the
 * opposite, so the list is its own page, an open graph gets the whole panel,
 * and the inspector docks beside the panel only while something is selected.
 */
export function StudioPage() {
 const [params] = useSearchParams(); const navigate = useNavigate();
 const rest = useParams()["*"] ?? "";
 const legacy = params.get("graph");
 async function create(kind: BuildableKind): Promise<void> {
  if (kind === "flow") { navigate(studioPath("new-flow")); return; }
  const list = await studio.list(); const count = list.filter(g => g.kind === kind).length + 1;
  const created = await studio.create(kind, `Untitled ${KIND_LABELS[kind].toLowerCase()} ${count}`);
  navigate(`${studioPath(created.id)}?panel=settings`);
 }
 /* Links from before the list/detail split used /studio?graph=<id>. */
 if (!rest && legacy) { const next = new URLSearchParams(params); next.delete("graph"); const query = next.toString(); return <Navigate replace to={`${studioPath(legacy)}${query ? `?${query}` : ""}`} />; }
 if (!rest) return <StudioIndex onCreate={create} />;
 return <StudioEditor key={rest} requested={decodeURIComponent(rest.split("/")[0]!)} />;
}

/** One sentence under each canvas on how to read it. */
const READING: Record<GraphKind, string> = {
 flow: "A flow runs its steps in order when its trigger fires; branches split on a step's result.",
 pipeline: "Top to bottom: a trigger starts the graph and each node hands its output down its connections.",
 router: "Left to right: a request arrives, each stage is tried in order, and the last node decides what happens when every stage is spent.",
 classifier: "Top to bottom: text comes in, the question sorts it, and each label is a way out.",
 boardflow: "Top to bottom: the columns a card passes through, with gates that need evidence before it moves on.",
 map: "Every note and the links between them.",
};

function StudioEditor({ requested }: { requested: string }) {
 const [params, setParams] = useSearchParams(); const navigate = useNavigate();
 const [graphs, setGraphs] = useState<GraphSummary[]>([]), [graph, setGraph] = useState<StudioGraph>();
 const [routine, setRoutine] = useState<Routine>(), [flowState, setFlowState] = useState<RoutineBuilderState>();
 const [map, setMap] = useState<KbGraphResponse>(), [mapSearch, setMapSearch] = useState(""), [hideOrphans, setHideOrphans] = useState(false);
 const [selected, setSelected] = useState<string | null>(null), [panel, setPanel] = useState<Panel>(() => params.get("panel") === "settings" || params.get("view") === "runs" ? params.get("panel") === "settings" ? "settings" : "runs" : null), [run, setRun] = useState<StudioRun | null>(null);
 const [error, setError] = useState(""), [notice, setNotice] = useState(""), [dirty, setDirty] = useState(false), [sourcePending, setSourcePending] = useState(false);
 const [busy, setBusy] = useState(false), [runRevision, setRunRevision] = useState(0), [loading, setLoading] = useState(true);
 const builder = useRef<RoutineBuilderHandle>(null);
 const summary = graphs.find(item => item.id === requested || item.name === requested || item.kind === "router" && `neoproxy/${item.name}` === requested);
 const id = summary?.id ?? requested; const flow = summary?.kind === "flow" || id === "new-flow", isMap = id === "map";
 const view: View = params.get("view") === "source" ? "source" : "canvas";
 const kbCounter = useStore(state => state.kbChangeCounter);
 const refresh = useCallback(async () => { try { setGraphs(await studio.list()); } catch (reason) { setError(String(reason)); setLoading(false); } }, []);
 useEffect(() => { void refresh(); }, [refresh]);
 /* ?panel= and the older ?view=runs open a panel once; they are not kept in the URL. */
 useEffect(() => { if (params.has("panel") || params.get("view") === "runs") setParams(previous => { const p = new URLSearchParams(previous); p.delete("panel"); if (p.get("view") === "runs") p.delete("view"); return p; }, { replace: true }); }, []);
 useEffect(() => {
  if (!summary && id !== "new-flow" && graphs.length === 0) return;
  let alive = true; setLoading(true); setGraph(undefined); setRoutine(undefined); setFlowState(undefined); setDirty(false); setSelected(null); setRun(null); setError(""); setNotice(""); setSourcePending(false);
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
 useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 5000); return () => clearTimeout(timer); }, [notice]);
 const selectedNode = graph?.nodes.find(node => node.id === selected);
 /* Escape on the canvas steps back: first out of a node, then out of the panel. */
 useEffect(() => {
  const listener = (event: KeyboardEvent) => {
   if (event.key !== "Escape" || event.defaultPrevented) return;
   const target = event.target as HTMLElement | null;
   if (target?.closest("input, textarea, [contenteditable='true'], [role='dialog'], [role='menu'], [role='listbox'], .neo-studio-switcher")) return;
   if (selected) setSelected(null); else if (panel) setPanel(null);
  };
  window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
 }, [selected, panel]);
 function changeView(next: View): void { if (sourcePending && next !== "source") { setError("Apply the source edits before leaving Source."); return; } setError(""); setParams(previous => { const p = new URLSearchParams(previous); if (next === "canvas") p.delete("view"); else p.set("view", next); return p; }); }
 function change(next: StudioGraph): void { setGraph(next); setDirty(true); setNotice(""); }
 async function save(): Promise<void> {
  setBusy(true); setError("");
  try { if (flow) await builder.current?.save(); else if (graph) { const problems = graphProblems(graph); if (problems.length) throw new Error(problems[0]!.message); const saved = await studio.save(graph); setGraph(saved); setDirty(false); setNotice(`Saved to ${stored.toLowerCase()}.`); await refresh(); } } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
 }
 async function toggle(enabled: boolean): Promise<void> {
  try { await studio.setEnabled(id, enabled); if (flow && routine) setRoutine({ ...routine, enabled }); if (graph) setGraph({ ...graph, enabled }); await refresh(); } catch (reason) { setError(String(reason)); }
 }
 async function startRun(): Promise<void> {
  setBusy(true); setError("");
  try { await studio.run(id); setNotice(flow ? "Run started. Its steps appear in Runs as the runner records them." : "Preview run finished. Nothing was sent outside the deck."); setRunRevision(value => value + 1); setSelected(null); setPanel("runs"); await refresh(); }
  catch (reason) {
   if (reason instanceof StudioRequestError && reason.problems.length) {
    const nodeId = reason.problems.find(problem => problem.nodeId)?.nodeId;
    if (nodeId) { setSelected(nodeId); setPanel(null); }
    setError(reason.problems.map(problem => problem.message).join("; "));
   } else setError(reason instanceof Error ? reason.message : String(reason));
  } finally { setBusy(false); }
 }
 async function remove(): Promise<void> { try { await studio.remove(id); setPanel(null); await refresh(); navigate("/studio"); } catch (reason) { setError(String(reason)); } }
 function savedRoutine(saved: Routine): void { setRoutine(saved); setNotice("Flow saved."); void refresh(); if (id === "new-flow") navigate(studioPath(saved.id), { replace: true }); }
 const runState = useMemo<Record<string, NodeRunState> | undefined>(() => run && !flow ? Object.fromEntries(run.nodes.map(step => [step.nodeId, { status: step.status, note: step.note }])) : undefined, [run, flow]);
 const title = flow ? flowState?.name ?? routine?.name ?? "New flow" : graph?.name ?? summary?.name ?? (isMap ? "Knowledge map" : loading ? "Loading graph" : "Graph unavailable");
 const unsaved = flow ? flowState?.dirty ?? false : dirty;
 const canSave = flow ? flowState?.canSave && (unsaved || id === "new-flow") : dirty && !sourcePending;
 const enabled = flow ? routine?.enabled ?? false : graph?.enabled ?? false;
 const router = graph?.kind === "router" || summary?.kind === "router";
 const stored = flow ? "Deck routines" : router ? "This browser, until NeoProxy can save routers" : SOURCES.studioGraphs === "live" ? "The deck server" : "This browser";
 const kind = isMap ? "map" : flow ? "flow" : graph?.kind ?? summary?.kind ?? "pipeline"; const KindIcon = KIND_ICONS[kind];
 const showPanel: "node" | Panel = selectedNode && panel !== "runs" ? "node" : panel;
 function rename(value: string): void { if (flow && flowState) builder.current?.updateSpec({ ...flowState.spec, name: value }); else if (graph) change({ ...graph, name: value }); }
 return <div className="neo-studio" data-panel={showPanel ?? undefined} data-map={isMap || undefined}>
  <header className="neo-studio-bar">
   <div className="neo-studio-ident">
    <Link to="/studio" className="neo-studio-back"><ArrowLeft size={13} />Studio</Link>
    <div className="neo-studio-title"><KindIcon size={16} aria-hidden="true" /><input className="neo-studio-name" aria-label="Graph name" value={title} readOnly={isMap || loading || (!flow && !graph)} onChange={event => rename(event.target.value)} size={Math.max(6, Math.min(40, title.length))} />{isMap ? null : <span className="neo-studio-kind">{KIND_LABELS[kind]}</span>}{!isMap && !flow ? <PreviewChip domains={["studioGraphs"]} what="This graph" /> : null}</div>
   </div>
   {isMap ? <div className="neo-studio-bar-tools">
    <SearchInput size="sm" value={mapSearch} onChange={setMapSearch} placeholder="Search notes on the map" aria-label="Search notes on the map" width={260} />
    <Check checked={hideOrphans} onChange={setHideOrphans}>Hide unlinked notes</Check>
    <Link className="neo-btn" data-size="sm" to="/knowledge?view=map"><MapIcon size={13} />Open in Knowledge</Link>
   </div> : <>
    <div className="neo-studio-bar-tools">
     {sourcePending ? <span className="neo-studio-state" data-dirty="true">Source not applied</span> : null}
     <label className="neo-studio-enabled" title={flow ? "An enabled flow runs on its schedule and triggers." : "Marks the graph as in use. Studio graphs do not yet start on their own triggers."}><Switch checked={enabled} onChange={next => void toggle(next)} disabled={loading || id === "new-flow"} label="Enabled" /><span>Enabled</span></label>
     <NeoButton size="sm" variant="ghost" on={panel === "runs"} aria-pressed={panel === "runs"} onClick={() => setPanel(current => current === "runs" ? null : "runs")} disabled={id === "new-flow"} title="Every time this graph ran, newest first"><History size={13} />Runs</NeoButton>
     <NeoButton size="sm" variant="ghost" on={showPanel === "settings"} aria-pressed={showPanel === "settings"} onClick={() => { setSelected(null); setPanel(current => current === "settings" ? null : "settings"); }}><SlidersHorizontal size={13} />{flow ? "Flow settings" : "Graph settings"}</NeoButton>
     <NeoButton size="sm" onClick={() => void startRun()} disabled={busy || loading || id === "new-flow" || unsaved || sourcePending} title={flow ? "Run the flow once now, for real" : "Walk the graph with its sample input. Nothing leaves the deck."}><Play size={12} />{flow ? "Run now" : "Preview run"}</NeoButton>
     <NeoButton size="sm" variant="primary" onClick={() => void save()} disabled={!canSave || busy}><Save size={12} />{unsaved || id === "new-flow" ? "Save" : "Saved"}</NeoButton>
    </div>
   </>}
  </header>
  {error ? <ErrorState className="neo-studio-error" error={error} /> : null}
  <div className="neo-studio-stage">
   <div className="neo-studio-view">
   {loading ? <Empty icon={Workflow} title="Loading graph" /> : isMap ? map ? <KnowledgeMap graph={map} focus={params.get("note") ?? undefined} query={mapSearch} hideOrphans={hideOrphans} onOpen={path => navigate(`/knowledge?note=${encodeURIComponent(path)}`)} />
    : <Empty icon={BookOpen} title="The map is empty" hint="Write a note in Knowledge to start linking ideas." /> : flow ? <div className="neo-studio-flow"><RoutineBuilder key={id} routine={routine} onSaved={savedRoutine} onError={setError} embedded view={view} editorRef={builder} onStateChange={setFlowState} /></div>
    : graph ? view === "canvas" ? <StudioCanvas key={id} graph={graph} selected={selected} onSelect={next => { setSelected(next); if (next && panel === "settings") setPanel(null); }} onChange={change} run={runState} /> : <SourceView graph={graph} onChange={change} onPending={setSourcePending} />
    : <Empty icon={Workflow} title="This graph could not be opened" hint={<>It may have been deleted. <Link to="/studio">Back to Studio</Link> lists every graph.</>} />}
   {notice ? <div className="neo-studio-notice" role="status">{notice}</div> : null}
   </div>
   {!loading ? <footer className="neo-studio-foot">{isMap ? map ? <>
    {mapLegend(map).slice(0, 8).map(dir => <span key={dir.name}><i style={{ background: dir.color }} />{dir.name}<small>{dir.count}</small></span>)}
    <span className="neo-studio-foot-hint">Larger dots have more links pointing at them. Click a note to read it.</span>
   </> : null : flow ? <><span>{READING.flow}</span><span className="neo-studio-foot-hint">Select a step to edit it.</span></>
    : graph ? <><Segmented label="Show the graph as" value={view} onChange={changeView} options={[{ value: "canvas", label: "Canvas" }, { value: "source", label: "TOML" }]} />
     {view === "source" ? <span>The same document the canvas draws. Apply to redraw the canvas.</span> : runState ? <><span><i data-run="ok" />Ran</span><span><i data-run="failed" />Failed</span><span><i data-run="skipped" />Skipped</span></> : <span>{READING[graph.kind]}</span>}
     {view === "canvas" ? <span className="neo-studio-foot-hint">Drag from a port to connect. <kbd>Delete</kbd> removes the selection.</span> : null}</> : null}</footer> : null}
  </div>
  {showPanel === "node" && graph && selectedNode ? <NodeInspector graph={graph} node={selectedNode} onChange={change} onClose={() => setSelected(null)} onDelete={nodeId => { change({ ...graph, nodes: graph.nodes.filter(n => n.id !== nodeId), edges: graph.edges.filter(e => e.from.node !== nodeId && e.to.node !== nodeId) }); setSelected(null); }} /> : null}
  {showPanel === "settings" ? flow ? <FlowInspector spec={flowState?.spec} onChange={spec => builder.current?.updateSpec(spec)} onDelete={id === "new-flow" ? undefined : () => void remove()} onClose={() => setPanel(null)} /> : graph ? <GraphSettings graph={graph} stored={stored} onChange={change} onDeleteGraph={() => void remove()} onClose={() => setPanel(null)} /> : null : null}
  {showPanel === "runs" && !isMap && id !== "new-flow" ? <RunsPanel key={id} graphId={id} graph={flow ? undefined : graph} refresh={runRevision} selected={run?.id ?? null} onSelect={setRun} onClose={() => { setPanel(null); setRun(null); }} /> : null}
 </div>;
}
