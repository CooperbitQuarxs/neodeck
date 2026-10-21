import { useState } from "react";
import { Drawer, ErrorState, NeoButton, SectionLabel } from "@/components/neo";
import { agents } from "../../client/agents";
import type { AgentTemplate } from "../../client/preview-data";
import { ModelPicker } from "../../components/ModelPicker";
import { RestrictionsEditor } from "./Restrictions";
export function TemplateDrawer({ template, isNew, onClose, onChanged }: { template: AgentTemplate; isNew: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
 const [draft, setDraft] = useState(template);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState<string | null>(null);
 async function save(remove = false) { setBusy(true); setError(null); try { if (remove) await agents.removeTemplate(draft.id); else await agents.saveTemplate({ ...draft, name: draft.name.trim(), blurb: draft.blurb.trim() }); await onChanged(); onClose(); } catch(e) { setError(`Could not save this template. ${String(e)}`); } finally { setBusy(false); } }
 return <Drawer open onClose={onClose} title={isNew ? "New template" : `Edit ${template.name}`} subtitle="A named set of restrictions, not a different kind of agent." footer={<><NeoButton variant={isNew ? "ghost" : "danger"} disabled={busy} onClick={isNew ? onClose : () => void save(true)}>{isNew ? "Cancel" : "Delete template"}</NeoButton><NeoButton variant="primary" disabled={busy || !draft.name.trim()} onClick={() => void save()}>Save changes</NeoButton></>}>
  <div className="neo-agents-drawer-stack">{error && <ErrorState error={error}/>}<label className="neo-agents-field">Name<input className="neo-input" value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})}/></label><label className="neo-agents-field">Description<textarea className="neo-input neo-agents-textarea" rows={3} value={draft.blurb} onChange={e => setDraft({...draft,blurb:e.target.value})}/></label><section><SectionLabel>Model</SectionLabel><ModelPicker value={draft.model} onChange={model => setDraft({...draft,model})}/></section><section><SectionLabel>Restrictions</SectionLabel><RestrictionsEditor value={draft.restrictions} onChange={restrictions => setDraft({...draft,restrictions})}/></section><p className="neo-agents-note">Saved in preview memory until reload. Existing agents keep the restrictions they were given.</p></div>
 </Drawer>;
}
