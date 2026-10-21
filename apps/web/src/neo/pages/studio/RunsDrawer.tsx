import { useEffect, useState } from "react";
import { Clock, Play } from "lucide-react";
import { Drawer, Empty, ErrorState, KeyValue, NeoBadge, NeoSelect, SectionLabel, Timeline, formatElapsed, formatTimestamp, type TimelineLane } from "@/components/neo";
import { studio, type StudioGraph, type StudioRun } from "../../client/studio";
import { nodeTitle } from "./StudioCanvas";
/** The same run evidence fits Studio's fixed Runs region or a right-side drawer. */
export function RunsDrawer({ graphId, graph, refresh, drawer, onClose }: { graphId: string; graph?: StudioGraph; refresh: number; drawer?: boolean; onClose?: () => void }) {
 const [runs, setRuns] = useState<StudioRun[]>([]), [selected, setSelected] = useState("");
 const [error, setError] = useState(""), [loading, setLoading] = useState(true), [span, setSpan] = useState<string | null>(null);
 useEffect(() => { let alive = true; setLoading(true); setError(""); void studio.runs(graphId).then(next => { if (!alive) return; setRuns(next); setSelected(previous => next.some(run => run.id === previous) ? previous : next[0]?.id ?? ""); setLoading(false); }).catch(reason => { if (alive) { setError(String(reason)); setLoading(false); } }); return () => { alive = false; }; }, [graphId, refresh]);
 const run = runs.find(item => item.id === selected);
 const lanes: TimelineLane[] = run?.nodes.map((node, index) => { const definition = graph?.nodes.find(n => n.id === node.nodeId); return { id: `${node.nodeId}-${index}`, label: definition ? nodeTitle(definition) : node.nodeId, sublabel: definition?.type ?? "Routine step", spans: [{ id: `${node.nodeId}-${index}`, start: Date.parse(node.startedAt), end: node.endedAt ? Date.parse(node.endedAt) : undefined, kind: definition?.type.startsWith("infer") || definition?.type.includes("classify") ? "model" : "tool", label: node.status === "ok" ? "Ran" : node.status, tone: node.status === "failed" ? "bad" : node.status === "running" ? "running" : node.status === "skipped" ? "skipped" : "ok", title: node.note }] }; }) ?? [];
 const selectedNode = run?.nodes.find((node, index) => `${node.nodeId}-${index}` === span);
 const content = <div className="neo-studio-runs">{error ? <ErrorState error={error} /> : loading ? <Empty icon={Clock} title="Loading runs" /> : !run ? <Empty icon={Play} title="No runs yet" hint="Run this graph to see timing for every node here." /> : <>
 <header className="neo-studio-runs-head"><div><h2>Run history</h2><p>{graph ? "Preview runs walk the graph without sending external actions." : "Live execution evidence from the routine runner."}</p></div><NeoSelect aria-label="Choose run" value={selected} onChange={event => { setSelected(event.target.value); setSpan(null); }}>{runs.map(item => <option key={item.id} value={item.id}>{formatTimestamp(item.startedAt)} · {item.ok === null ? "Running" : item.ok ? "Passed" : "Failed"}</option>)}</NeoSelect></header>
 <div className="neo-studio-run-summary"><NeoBadge tone={run.ok === null ? "accent" : run.ok ? "ok" : "bad"}>{run.ok === null ? "Running" : run.ok ? "Passed" : "Failed"}</NeoBadge><KeyValue items={[{ key: "Started", value: formatTimestamp(run.startedAt) }, { key: "Duration", value: run.endedAt ? formatElapsed(Date.parse(run.endedAt) - Date.parse(run.startedAt)) : "Running" }, { key: "Cost", value: run.costUsd !== undefined ? `$${run.costUsd.toFixed(3)}` : "Not reported" }, { key: "Trigger", value: run.trigger }]} /></div>
 <SectionLabel>Node timings</SectionLabel>{lanes.length ? <Timeline lanes={lanes} gutter={150} selected={span} onSelect={s => setSpan(s.id)} /> : <Empty title="Run is queued" hint="The runner will add node timings as steps start. Open Runs again to refresh." />}
 {selectedNode ? <div className="neo-studio-run-note"><SectionLabel>{selectedNode.nodeId}</SectionLabel><p>{selectedNode.note || "No additional output was recorded."}</p></div> : <p className="neo-studio-help">Select a span to read its output.</p>}
 </>}</div>;
 return drawer ? <Drawer open onClose={onClose ?? (() => {})} title="Graph runs" width={760}>{content}</Drawer> : content;
}
