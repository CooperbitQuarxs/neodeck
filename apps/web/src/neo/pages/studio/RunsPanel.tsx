import { useEffect, useState } from "react";
import { Empty, ErrorState, KeyValue, formatElapsed, formatShortRelative, formatTimestamp } from "@/components/neo";
import { studio, type StudioGraph, type StudioRun } from "../../client/studio";
import { nodeTitle } from "./StudioCanvas";
import { StudioPanel } from "./StudioPanel";

const WORDS = { ok: "Ran", failed: "Failed", skipped: "Skipped", running: "Running" } as const;
function outcome(run: StudioRun): { tone: string; word: string } { return run.ok === null ? { tone: "running", word: "Running" } : run.ok ? { tone: "ok", word: "Passed" } : { tone: "failed", word: "Failed" }; }

/**
 * A graph is a template; a run is one instance of it, one input walking the
 * graph. Picking a run paints its node outcomes onto the canvas, so the run is
 * read where the graph is drawn rather than in a separate table.
 */
export function RunsPanel({ graphId, graph, refresh, selected, onSelect, onClose }: { graphId: string; graph?: StudioGraph; refresh: number; selected: string | null; onSelect: (run: StudioRun | null) => void; onClose: () => void }) {
 const [runs, setRuns] = useState<StudioRun[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true);
 useEffect(() => {
  let alive = true; setLoading(true); setError("");
  void studio.runs(graphId).then(next => {
   if (!alive) return;
   const sorted = [...next].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
   setRuns(sorted); setLoading(false);
   const keep = sorted.find(run => run.id === selected) ?? (refresh > 0 ? sorted[0] : undefined);
   onSelect(keep ?? null);
  }).catch(reason => { if (alive) { setError(String(reason)); setLoading(false); } });
  return () => { alive = false; };
 }, [graphId, refresh]);
 const run = runs.find(item => item.id === selected);
 return <StudioPanel title="Runs" subtitle={graph ? "Each run is one input walking this graph." : "Each run is one execution of this flow."} onClose={onClose}>
  {error ? <ErrorState error={error} /> : loading ? <p className="neo-studio-help">Loading runs…</p> : runs.length === 0 ? <Empty title="No runs yet" hint={graph ? "Preview run walks the graph with a sample input and sends nothing outside the deck." : "Run now starts the flow once; scheduled runs appear here too."} /> : <>
   <div className="neo-studio-runs" role="group" aria-label="Runs, newest first">
    {runs.map(item => { const o = outcome(item); return <button key={item.id} type="button" aria-pressed={item.id === selected} className="neo-studio-run-row" data-current={item.id === selected || undefined} onClick={() => onSelect(item.id === selected ? null : item)}>
     <i data-run={o.tone} /><span>{o.word}</span><small>{item.mode === "execute" ? "Executed" : item.mode === "preview" ? "Preview" : item.trigger}{item.mode && item.trigger && !/preview/i.test(item.trigger) ? `, ${item.trigger}` : ""}</small><time dateTime={item.startedAt} title={formatTimestamp(item.startedAt)}>{formatShortRelative(item.startedAt)}</time>
    </button>; })}
   </div>
   {run ? <section className="neo-studio-run-detail" aria-label="Selected run">
    <KeyValue items={[{ key: "Started", value: formatTimestamp(run.startedAt) }, { key: "Duration", value: run.endedAt ? formatElapsed(Date.parse(run.endedAt) - Date.parse(run.startedAt)) : "Still running" }, { key: "Cost", value: run.costUsd !== undefined ? `$${run.costUsd.toFixed(3)}` : "Unknown" }]} />
    {graph ? <p className="neo-studio-help">Outcomes are drawn on the canvas. Select the run again to clear them.</p> : null}
    <ol className="neo-studio-run-steps">
     {run.nodes.length === 0 ? <li className="neo-studio-help">The runner has not recorded any steps yet.</li> : run.nodes.map((step, index) => { const node = graph?.nodes.find(n => n.id === step.nodeId); return <li key={`${step.nodeId}-${index}`}>
      <i data-run={step.status} /><span><strong>{node ? nodeTitle(node) : step.nodeId}</strong><small>{WORDS[step.status]}{step.endedAt ? `, ${formatElapsed(Date.parse(step.endedAt) - Date.parse(step.startedAt))}` : ""}</small>{step.note ? <p>{step.note}</p> : null}</span>
     </li>; })}
    </ol>
   </section> : <p className="neo-studio-help">Choose a run to see what each step did.</p>}
  </>}
 </StudioPanel>;
}
