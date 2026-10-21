import { useEffect, useState } from "react";
import { Drawer, ErrorState, NeoButton, NeoSelect, SectionLabel } from "@/components/neo";
import { agents, type SpawnAgentInput, type WhereOption } from "../client/agents";
import { PREVIEW_TEMPLATES, type AgentTemplate, type Restriction } from "../client/preview-data";
import { RestrictionChips } from "../pages/agents/Restrictions";
import { AgentSwatch } from "./AgentSwatch";
import { ModelPicker } from "./ModelPicker";
import "../pages/agents.css";
export type { SpawnAgentInput, WhereOption } from "../client/agents";
export interface SpawnAgentDrawerProps { open: boolean; onClose: () => void; where?: WhereOption[]; initialTemplate?: string; onSpawn: (input: SpawnAgentInput) => void | Promise<void> }
const HUES = [190, 300, 40, 150, 260, 20];
export function SpawnAgentDrawer({ open, onClose, where = [{ kind: "thread", id: "", label: "A new thread" }, { kind: "routine", id: "judge", label: "Every session (watcher)" }], initialTemplate = "worker", onSpawn }: SpawnAgentDrawerProps) {
 const [templates, setTemplates] = useState<readonly AgentTemplate[]>(PREVIEW_TEMPLATES);
 const [template, setTemplate] = useState(initialTemplate);
 const [restrictions, setRestrictions] = useState<Restriction[]>([]);
 const [name, setName] = useState("");
 const [model, setModel] = useState("neoproxy/heavy");
 const [hue, setHue] = useState(190);
 const [destination, setDestination] = useState(0);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState<string | null>(null);
 useEffect(() => {
  if (!open) return;
  setError(null); setDestination(0);
  void agents.templates().then(list => { setTemplates(list); const t = list.find(t => t.id === initialTemplate) ?? list[0]; if (t) { setTemplate(t.id); setName(t.name); setModel(t.model); setRestrictions([...t.restrictions]); } }).catch(e => setError(String(e)));
 }, [open, initialTemplate]);
 function choose(t: AgentTemplate) { setTemplate(t.id); setName(t.name); setModel(t.model); setRestrictions([...t.restrictions]); }
 async function spawn() {
  if (!name.trim() || !where[destination]) return;
  setBusy(true); setError(null);
  try { await onSpawn({ template, name: name.trim(), model, hue, restrictions, where: { kind: where[destination]!.kind, id: where[destination]!.id } }); onClose(); } catch(e) { setError(`Could not spawn the agent. ${String(e)}`); } finally { setBusy(false); }
 }
 return <Drawer open={open} onClose={onClose} title="Spawn agent" subtitle="Choose a starting point. Every restriction can be removed." width={520} footer={<><span className="neo-agents-note">Preview agent, no live session is started.</span><NeoButton variant="primary" disabled={busy || !name.trim()} onClick={() => void spawn()}>{busy ? "Spawning…" : "Spawn"}</NeoButton></>}>
  <div className="neo-agents-drawer-stack">{error && <ErrorState error={error}/>}
   <section><SectionLabel>Template</SectionLabel><div className="neo-agents-template-options" role="radiogroup" aria-label="Agent template">{templates.map(t => <div className="neo-agents-template-option" data-selected={t.id === template} key={t.id}><button type="button" role="radio" aria-checked={t.id === template} onClick={() => choose(t)}><span className="neo-agents-radio"/><span><strong>{t.name}</strong><span className="neo-agents-note">{t.blurb}</span></span></button>{t.id === template && <RestrictionChips value={restrictions} onChange={setRestrictions}/>}</div>)}</div></section>
   <label className="neo-agents-field">Name<input className="neo-input" value={name} onChange={e => setName(e.target.value)} placeholder="Agent name"/></label>
   <section><SectionLabel>Model</SectionLabel><ModelPicker value={model} onChange={setModel}/></section>
   <section><SectionLabel>Colour</SectionLabel><div className="neo-agents-hues" role="radiogroup" aria-label="Agent colour">{HUES.map(h => <button type="button" role="radio" aria-checked={h === hue} aria-label={`Hue ${h}`} className="neo-agents-hue" data-selected={h === hue} key={h} onClick={() => setHue(h)}><AgentSwatch hue={h} size={16}/></button>)}<AgentSwatch hue={hue} name={name || "Agent"}/></div></section>
   <label className="neo-agents-field">Where<NeoSelect value={destination} onChange={e => setDestination(Number(e.target.value))}>{where.map((w,i) => <option value={i} key={`${w.kind}:${w.id}`}>{w.label}</option>)}</NeoSelect></label>
  </div>
 </Drawer>;
}
