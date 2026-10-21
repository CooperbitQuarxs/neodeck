import type { RoutineSpec } from "@npi-deck/protocol";
import { Clock } from "lucide-react";
import { NeoBadge, SectionLabel } from "@/components/neo";
export function FlowInspector({ spec, onChange }: { spec?: RoutineSpec; onChange: (spec: RoutineSpec) => void }) {
 return <div className="neo-studio-inspector"><header className="neo-studio-inspector-head"><Clock size={14} /><h2>Flow settings</h2><NeoBadge>Live</NeoBadge></header><div className="neo-studio-inspector-body">{spec ? <>
 <label className="neo-field">Name<input className="neo-input" value={spec.name} onChange={event => onChange({ ...spec, name: event.target.value })} /></label>
 <label className="neo-field">Description<textarea className="neo-input" rows={3} value={spec.description ?? ""} onChange={event => onChange({ ...spec, description: event.target.value })} /></label>
 <label className="neo-field">Schedule<input className="neo-input neo-mono" value={spec.trigger.flatMap(trigger => "cron" in trigger ? [trigger.cron] : [])[0] ?? ""} placeholder="On demand, or a cron expression" onChange={event => { const other = spec.trigger.filter(trigger => !("cron" in trigger) && !("manual" in trigger)); onChange({ ...spec, trigger: [...other, ...(event.target.value ? [{ cron: event.target.value }] : [{ manual: {} }])] }); }} /></label>
 <label className="neo-field">Timezone<input className="neo-input" value={spec.timezone ?? ""} placeholder="System timezone" onChange={event => onChange({ ...spec, timezone: event.target.value || undefined })} /></label>
 <label className="neo-field">Tags<input className="neo-input" value={spec.tags?.join(", ") ?? ""} placeholder="office, daily" onChange={event => onChange({ ...spec, tags: event.target.value.split(",").map(tag => tag.trim()).filter(Boolean) })} /></label>
 </> : <p className="neo-studio-help">Loading the flow's settings…</p>}<SectionLabel>Editing a flow</SectionLabel><p className="neo-studio-help">The routine builder keeps its own node inspector inside the canvas. Select a step there to edit it. These settings and the toolbar edit that same draft.</p><p className="neo-studio-help">The enabled switch saves immediately. Save writes the canvas, schedule and settings together.</p></div></div>;
}
