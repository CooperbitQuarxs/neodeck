import { Cpu, Eye, FileText, GitFork, Hourglass, Plus, Wrench, X } from "lucide-react";
import { useState } from "react";
import { NeoButton, NeoSelect } from "@/components/neo";
import type { Restriction } from "../../client/preview-data";
export const RESTRICTION_ICONS = { visibility: Eye, lifecycle: Hourglass, spawn: GitFork, model: Cpu, prompt: FileText, tools: Wrench };
export function RestrictionChips({ value, onChange }: { value: readonly Restriction[]; onChange?: (value: Restriction[]) => void }) {
 return <div className="neo-agents-chips">{value.map((r, i) => { const Icon = RESTRICTION_ICONS[r.key]; return onChange ? <button type="button" className="neo-chip-btn" key={`${r.key}-${i}`} title={`Remove restriction: ${r.label}`} onClick={() => onChange(value.filter((_, index) => i !== index))}><Icon size={11}/>{r.label}<X size={11}/></button> : <span className="neo-chip-btn" title={r.label} key={`${r.key}-${i}`}><Icon size={11}/>{r.label}</span>; })}</div>;
}
export function RestrictionsEditor({ value, onChange }: { value: readonly Restriction[]; onChange: (value: Restriction[]) => void }) {
 const [adding, setAdding] = useState(false);
 const [key, setKey] = useState<Restriction["key"]>("visibility");
 const [label, setLabel] = useState("");
 return <div className="neo-agents-stack"><RestrictionChips value={value} onChange={onChange}/>{!value.length && <p className="neo-agents-note">No restrictions. Same prompt, same tools, same everything as you.</p>}{adding ? <form className="neo-agents-restriction-form" onSubmit={e => { e.preventDefault(); if (!label.trim()) return; onChange([...value, { key, label: label.trim() }]); setLabel(""); setAdding(false); }}><NeoSelect aria-label="Restriction key" value={key} onChange={e => setKey(e.target.value as Restriction["key"])}>{Object.keys(RESTRICTION_ICONS).map(k => <option key={k}>{k}</option>)}</NeoSelect><input className="neo-input" aria-label="Restriction" placeholder="Describe the restriction" value={label} onChange={e => setLabel(e.target.value)}/><NeoButton type="submit" disabled={!label.trim()}>Add</NeoButton><NeoButton variant="ghost" onClick={() => setAdding(false)} aria-label="Cancel restriction"><X size={13}/></NeoButton></form> : <NeoButton variant="ghost" size="sm" onClick={() => setAdding(true)}><Plus size={12}/>Add restriction</NeoButton>}</div>;
}
