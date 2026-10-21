import { useState } from "react";
import { Link } from "react-router-dom";
import { Dot, Drawer, ErrorState, formatCompact, formatRelativeTime, KeyValue, NeoBadge, NeoButton, SectionLabel } from "@/components/neo";
import { agents, agentLink, formatCost, type AgentRecord } from "../../client/agents";
import type { AgentState } from "../../client/preview-data";
import { AgentSwatch } from "../../components/AgentSwatch";
import { ModelPicker } from "../../components/ModelPicker";
import { RestrictionsEditor } from "./Restrictions";
export function StateBadge({ state }: { state: AgentState }) { return <NeoBadge tone={state === "needs-you" ? "accent" : state === "working" ? "ok" : state === "parked" ? "warn" : undefined}>{state === "working" && <Dot tone="live" pulse/>}{state === "needs-you" ? "needs you" : state}</NeoBadge>; }
export function AgentDrawer({ agent, onClose, onChanged }: { agent: AgentRecord | null; onClose: () => void; onChanged: () => Promise<void> }) {
 const [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState(false);
 async function change(action: () => Promise<void>) { setBusy(true); setError(null); try { await action(); await onChanged(); } catch(e) { setError(`Could not update this agent. ${String(e)}`); } finally { setBusy(false); } }
 if (!agent) return null;
 const thread = agent.sessionId ?? agent.where.id;
 return <Drawer open onClose={onClose} title={<AgentSwatch hue={agent.hue} name={agent.name}/>} subtitle={<>{agent.template} · <span className="neo-mono">{agent.model}</span> · @{agent.owner} · {formatRelativeTime(agent.since)}</>} width={560} footer={<><NeoButton variant="danger" disabled={busy || agent.state === "done"} onClick={() => void change(() => agents.stop(agent.id))}>Stop</NeoButton><Link className="neo-btn" data-variant="primary" to={`/threads?thread=${encodeURIComponent(thread)}&target=${encodeURIComponent(agent.runtimeId ?? agent.id)}`}>Message</Link></>}>
  <div className="neo-agents-drawer-stack">{error && <ErrorState error={error}/>}
   <section><SectionLabel>State</SectionLabel><div className="neo-agents-state"><StateBadge state={agent.state}/><span>{agent.activity ?? `${agent.where.label} · last tool call 2m ago`}</span></div></section>
   <section><SectionLabel>Restrictions</SectionLabel><RestrictionsEditor value={agent.restrictions} onChange={r => void change(() => agents.setRestrictions(agent.id, r))}/>{agent.sessionId && <p className="neo-agents-note">Restriction changes stay local. This engine cannot apply them to a live agent yet.</p>}</section>
   <section><SectionLabel>Model</SectionLabel><ModelPicker value={agent.model} onChange={model => void change(() => agents.setModel(agent.id, model))} disabled={busy}/>{agent.sessionId && agent.runtimeKind !== "main" && <p className="neo-agents-note">Model changes for this agent stay in the preview until the runtime supports them.</p>}</section>
   <section><SectionLabel>Where</SectionLabel><Link className="neo-chip" to={agentLink(agent.where)}>{agent.where.label}</Link>{agent.where.kind === "thread" && <div className="neo-agents-open-thread"><Link className="neo-btn" data-variant="primary" to={agentLink(agent.where)}>Open thread</Link></div>}</section>
   <section><SectionLabel>Usage</SectionLabel><KeyValue items={[{key:"Tokens",value:formatCompact(agent.tokens)},{key:"Cost",value:formatCost(agent.costUsd)},{key:"Turns",value:agent.turns ?? "Not reported"},{key:"Since",value:formatRelativeTime(agent.since)}]}/></section>
  </div>
 </Drawer>;
}
