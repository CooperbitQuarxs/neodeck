import { Check, Info, OctagonX, Pause, Play, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Card, Dot, Empty, ErrorState, formatShortRelative, NeoButton, SearchInput, Segmented } from "@/components/neo";
import { agents } from "../../client/agents";
import type { JudgeEvent } from "../../client/preview-data";
export function JudgeFeed({ events, watching, onChanged }: { events: JudgeEvent[]; watching: number; onChanged: () => Promise<void> }) {
 const [filter, setFilter] = useState<"all" | "warn" | "bad">("all");
 const [search, setSearch] = useState("");
 const [expanded, setExpanded] = useState<string[]>([]);
 const [undone, setUndone] = useState<string[]>([]);
 const [busy, setBusy] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [paused, setPaused] = useState(agents.judgePaused());
 const needle = search.toLowerCase().trim();
 const visible = events.filter(e => (filter === "all" || e.tone === filter) && (!needle || `${e.agent} ${e.where} ${e.text}`.toLowerCase().includes(needle)));
 async function undo(id: string) { setBusy(id); setError(null); try { await agents.judgeUndoStop(id); setUndone(old => [...old,id]); await onChanged(); } catch(e) { setError(`Could not undo the stop. ${String(e)}`); } finally { setBusy(null); } }
 return <Card className="neo-agents-judge" title="Judge" description="Watches every session; stops what was not sanctioned." actions={<span className="neo-agents-watching"><Dot tone={paused ? "warn" : "live"} pulse={!paused}/>{paused ? "paused" : `watching ${watching}`}</span>} flush footer={<><span>Judge: <span className="neo-mono">neoproxy/heavy</span><span className="neo-agents-note">every 2 min</span></span><NeoButton size="sm" variant="ghost" onClick={() => { agents.setJudgePaused(!paused); setPaused(!paused); void onChanged(); }}>{paused ? <Play size={12}/> : <Pause size={12}/>}{paused ? "Resume" : "Pause"}</NeoButton></>}>
  <div className="neo-agents-judge-toolbar"><Segmented label="Judge events" value={filter} onChange={setFilter} options={[{value:"all",label:"All"},{value:"warn",label:<>Warnings <span className="neo-num">{events.filter(e=>e.tone==="warn").length}</span></>},{value:"bad",label:<>Stopped <span className="neo-num">{events.filter(e=>e.tone==="bad").length}</span></>}]}/><SearchInput size="sm" value={search} onChange={setSearch} placeholder="Search judge log" aria-label="Search judge log"/></div>
  {error && <ErrorState error={error}/>}<div className="neo-judge-feed">{visible.length ? visible.map(e => { const Icon = e.tone === "ok" ? Check : e.tone === "warn" ? TriangleAlert : e.tone === "bad" ? OctagonX : Info; const open = expanded.includes(e.id); return <article className="neo-agents-event" data-tone={e.tone} key={e.id}><Icon className="neo-agents-event-glyph" size={15}/><time className="neo-agents-event-time neo-mono" dateTime={e.at} title={new Date(e.at).toLocaleString()}>{formatShortRelative(e.at)}</time><div className="neo-agents-event-body"><div className="neo-agents-event-title"><strong>{e.agent}</strong><span> · {e.where}</span></div><button type="button" className="neo-agents-event-text" data-expanded={open} aria-expanded={open} onClick={() => setExpanded(old => open ? old.filter(id => id !== e.id) : [...old,e.id])}>{e.text}</button>{e.tone === "bad" && <NeoButton variant="ghost" size="sm" disabled={busy === e.id || undone.includes(e.id)} onClick={() => void undo(e.id)}>{undone.includes(e.id) ? "Worker restored" : "Undo stop"}</NeoButton>}</div></article>; }) : <Empty icon={Info} title="No matching events" hint="Clear the search or choose another event filter."/>}</div>
 </Card>;
}
