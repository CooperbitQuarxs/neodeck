import { useState } from "react";
import { Check, X } from "lucide-react";
import { Drawer, ErrorState, NeoButton, SectionLabel } from "@/components/neo";
import { PREVIEW_TEMPLATES, type AgentTemplate, type Restriction } from "../../client/preview-data";
import type { AddThreadAgentInput, ThreadAgent } from "../../client/threads";
import { agentColor, AgentSwatch } from "../../components/AgentSwatch";
import { ModelPicker } from "../../components/ModelPicker";

export interface ThreadSpawnAgentDrawerProps {
	open: boolean;
	onClose: () => void;
	agents: readonly ThreadAgent[];
	live?: boolean;
	onSpawn: (input: AddThreadAgentInput) => Promise<void>;
}
/** Thread-specific form. Restrictions belong to the participant, not to an agent type. */
export function ThreadSpawnAgentDrawer(props: ThreadSpawnAgentDrawerProps) {
	return props.open ? <SpawnForm {...props} /> : null;
}
function SpawnForm({ onClose, agents, live, onSpawn }: ThreadSpawnAgentDrawerProps) {
	const first = PREVIEW_TEMPLATES[0]!;
	function availableName(template: AgentTemplate): string { let name = template.name; let i = 2; while (agents.some((a) => a.name === name)) name = `${template.name} ${i++}`; return name; }
	const [template, setTemplate] = useState(first);
	const [name, setName] = useState(availableName(first));
	const [model, setModel] = useState(first.model);
	const [restrictions, setRestrictions] = useState<Record<string, Restriction[]>>(() => Object.fromEntries(PREVIEW_TEMPLATES.map((t) => [t.id, [...t.restrictions]])));
	const hues = [190, 300, 40, 150, 260, 20].sort((a, b) => Number(agents.some((agent) => agent.hue === a)) - Number(agents.some((agent) => agent.hue === b)));
	const [hue, setHue] = useState(hues[0]!);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	async function submit(): Promise<void> {
		setBusy(true); setError(undefined);
		try { await onSpawn({ template: template.id, name: name.trim(), model, hue, restrictions: restrictions[template.id] ?? [] }); onClose(); }
		catch (e) { setError(`Could not add the agent. ${String(e)}`); }
		finally { setBusy(false); }
	}
	return <Drawer open onClose={onClose} width={520} title="Add an agent to this thread" subtitle="Choose a starting point. Remove any restriction you don't want." footer={<div className="neo-threads-spawn-footer"><div className="flex gap-2"><NeoButton variant="primary" disabled={busy || !name.trim()} onClick={() => void submit()}>{busy ? "Adding agent…" : "Add agent"}</NeoButton><NeoButton variant="ghost" onClick={onClose}>Cancel</NeoButton></div>{live ? <p className="neo-preview">Added agents are preview participants. Only Main can answer on the live backend today.</p> : null}</div>}>
		<div className="neo-threads-spawn">
			<div role="radiogroup" aria-label="Agent template" className="neo-threads-templates">
				{PREVIEW_TEMPLATES.map((item) => <div key={item.id} className="neo-threads-template" data-active={template.id === item.id}>
					<button type="button" role="radio" aria-checked={template.id === item.id} className="neo-threads-template-choice" onClick={() => { setTemplate(item); setName(availableName(item)); setModel(item.model); }}><span className="neo-threads-radio">{template.id === item.id ? <Check size={11} /> : null}</span><span><strong>{item.name}</strong><span className="neo-threads-template-blurb">{item.blurb}</span><span className="neo-mono neo-threads-template-model">{item.model}</span></span></button>
					{(restrictions[item.id]?.length ?? 0) > 0 ? <div className="neo-threads-restrictions">{restrictions[item.id]!.map((r) => <button key={r.key} type="button" className="neo-chip-btn" title={`Remove ${r.label}`} aria-label={`Remove ${r.label} from ${item.name}`} onClick={() => setRestrictions((current) => ({ ...current, [item.id]: current[item.id]!.filter((entry) => entry.key !== r.key) }))}>{r.label}<X size={10} /></button>)}</div> : <p className="neo-threads-unrestricted">No restrictions</p>}
				</div>)}
			</div>
			<label className="neo-threads-field"><SectionLabel>Name</SectionLabel><input className="neo-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
			<div className="neo-threads-field"><SectionLabel>Model</SectionLabel><ModelPicker value={model} onChange={setModel} /></div>
			<div className="neo-threads-field"><SectionLabel>Colour</SectionLabel><div className="neo-threads-colours">{hues.map((value) => <button type="button" key={value} className="neo-threads-colour" style={{ color: agentColor(value) }} data-active={hue === value} aria-label={`Hue ${value}`} aria-pressed={hue === value} onClick={() => setHue(value)}><AgentSwatch hue={value} size={20} />{hue === value ? <Check size={12} /> : null}</button>)}</div></div>
			{error ? <ErrorState error={error} /> : null}
		</div>
	</Drawer>;
}
