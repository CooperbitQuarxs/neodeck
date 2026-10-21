import "./agents.css";
import { Bot, KanbanSquare, MessageSquare, Plus, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AsyncView, Card, Check, Empty, ErrorState, formatCompact, formatShortRelative, NeoButton, NeoSelect, PageHeader, SearchInput, SectionLabel, Stat, StatGrid, Table, Toolbar, type Column } from "@/components/neo";
import { useStore } from "@/lib/store";
import { agents, agentLink, formatCost, subscribeAgents, type AgentRecord, type SpawnAgentInput, type WhereOption } from "../client/agents";
import { useAccount } from "../client/auth";
import { PREVIEW_ACCOUNTS, type AgentState, type AgentTemplate, type JudgeEvent } from "../client/preview-data";
import { AgentSwatch } from "../components/AgentSwatch";
import { Avatar } from "../components/Avatar";
import { PreviewChip } from "../components/PreviewChip";
import { SpawnAgentDrawer } from "../components/SpawnAgentDrawer";
import { NAV_ITEMS } from "../nav";
import { AgentDrawer, StateBadge } from "./agents/AgentDrawer";
import { JudgeFeed } from "./agents/JudgeFeed";
import { RestrictionChips } from "./agents/Restrictions";
import { TemplateDrawer } from "./agents/TemplateDrawer";
const STATES: AgentState[] = ["needs-you", "working", "parked", "idle", "done"];
const item = NAV_ITEMS.find(i => i.to === "/agents")!;
export function AgentsPage() {
 const [roster, setRoster] = useState<AgentRecord[] | null>(null);
 const [templates, setTemplates] = useState<AgentTemplate[]>([]);
 const [events, setEvents] = useState<JudgeEvent[]>([]);
 const [where, setWhere] = useState<WhereOption[]>([]);
 const [error, setError] = useState<string | null>(null);
 const [search, setSearch] = useState("");
 const [state, setState] = useState("all");
 const [template, setTemplate] = useState("all");
 const [mine, setMine] = useState(false);
 const [selected, setSelected] = useState<string | null>(null);
 const [highlight, setHighlight] = useState<string | null>(null);
 const [spawning, setSpawning] = useState<string | null>(null);
 const [editing, setEditing] = useState<{ template: AgentTemplate; isNew: boolean } | null>(null);
 const account = useAccount();
 const runtime = useStore(s => Object.values(s.sessionsById).map(v => `${v.sessionId}:${v.status}:${v.turnCount}:${v.advisorActivity}`).join("|"));
 const workers = useStore(s => s.subagentsBySession);
 const tasksCounter = useStore(s => s.tasksChangeCounter);
 const request = useRef(0);
 const refresh = useCallback(async () => {
  const epoch = ++request.current;
  try { const [rows, t, j, w] = await Promise.all([agents.roster(), agents.templates(), agents.judge({}), agents.destinations()]); if (epoch !== request.current) return; setRoster(rows); setTemplates(t); setEvents(j); setWhere(w); setError(null); } catch(e) { if (epoch === request.current) setError(`Could not load the agents. ${String(e)}`); }
 }, []);
 useEffect(() => { void refresh(); }, [refresh, runtime, workers, tasksCounter]);
 useEffect(() => subscribeAgents(() => { void refresh(); }), [refresh]);
 useEffect(() => { if (!highlight) return; const timer = window.setTimeout(() => setHighlight(null), 3000); return () => window.clearTimeout(timer); }, [highlight]);
 const visible = useMemo(() => { const needle = search.trim().toLowerCase(); return (roster ?? []).filter(a => (state === "all" || a.state === state) && (template === "all" || a.template === template) && (!mine || a.owner === account?.handle) && (!needle || `${a.name} ${a.template} ${a.model} ${a.where.label} ${a.owner} ${a.restrictions.map(r => r.label).join(" ")}`.toLowerCase().includes(needle))); }, [roster, state, template, mine, account?.handle, search]);
 const columns: Column<AgentRecord>[] = [
  { key: "agent", header: "Agent", render: a => <div className="neo-agents-identity"><AgentSwatch name={a.name} hue={a.hue}/><div className="neo-agents-template-line"><span className="neo-agents-template-name">{a.template}{a.id.startsWith("live:") ? " · live" : ""}</span><div className="neo-agents-row-restrictions"><RestrictionChips value={a.restrictions}/></div></div></div> },
  { key: "model", header: "Model", render: a => <span className="neo-mono neo-agents-model" title={a.model}>{a.model}</span> },
  { key: "where", header: "Where", render: a => { const Icon = a.where.kind === "thread" ? MessageSquare : a.where.kind === "card" ? KanbanSquare : Workflow; return <Link className="neo-agents-where" to={agentLink(a.where)} title={a.where.label} onClick={e => e.stopPropagation()}><Icon size={12}/><span>{a.where.label}</span></Link>; } },
  { key: "state", header: "State", sort: a => STATES.indexOf(a.state), render: a => <StateBadge state={a.state}/> },
  { key: "owner", header: "Owner", render: a => <span className="neo-agents-owner"><Avatar size={17} account={PREVIEW_ACCOUNTS.find(u => u.handle === a.owner) ?? { name: a.owner, hue: 190 }}/>{a.owner}</span> },
  { key: "tokens", header: "Tokens", align: "right", render: a => <span className="neo-num">{formatCompact(a.tokens)}</span> },
  { key: "cost", header: "Cost", align: "right", sort: a => a.costUsd, render: a => <span className="neo-num">{formatCost(a.costUsd)}</span> },
  { key: "since", header: "Since", sort: a => a.since, render: a => <span className="neo-num neo-agents-note" title={new Date(a.since).toLocaleString()}>{formatShortRelative(a.since)}</span> },
 ];
 async function spawn(input: SpawnAgentInput) { const created = await agents.spawn(input); setState("all"); setTemplate("all"); setSearch(""); setMine(false); await refresh(); setHighlight(created.id); }
 return <div className="neo-fill"><PageHeader title={item.label} description={item.blurb} badge={<PreviewChip domains={["agents","judge"]}/>} actions={<NeoButton variant="primary" onClick={() => setSpawning("worker")}><Plus size={14}/>Spawn agent</NeoButton>}/>
  <div className="neo-agents neo-fill-body"><div className="neo-agents-left">
   <StatGrid><Stat label="Working" value={roster?.filter(a => a.state === "working").length ?? "–"} foot="across threads and cards"/><Stat label="Needs you" value={roster?.filter(a => a.state === "needs-you").length ?? "–"} foot="ready for your answer"/><Stat label="Parked" value={roster?.filter(a => a.state === "parked").length ?? "–"} foot="waiting to be dismissed"/><Stat label="Spent today" value={roster ? formatCost(roster.reduce((sum,a) => sum + a.costUsd, 0)) : "–"} foot="all agents on the deck"/></StatGrid>
   <Toolbar className="neo-agents-toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search agents" aria-label="Search agents"/><NeoSelect aria-label="Filter by state" value={state} onChange={e => setState(e.target.value)}><option value="all">State: All</option>{STATES.map(s => <option value={s} key={s}>{s === "needs-you" ? "Needs you" : s[0]!.toUpperCase()+s.slice(1)}</option>)}</NeoSelect><NeoSelect aria-label="Filter by template" value={template} onChange={e => setTemplate(e.target.value)}><option value="all">Template: All</option>{templates.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</NeoSelect><Check checked={mine} onChange={setMine}>Mine</Check></Toolbar>
   <Card flush className="neo-agents-roster"><AsyncView data={roster} error={error} onRetry={() => void refresh()}>{() => <Table columns={columns} rows={visible} rowKey={a => a.id} initialSort={{ key:"state", dir:"asc" }} selectedKey={highlight ?? selected} onRowClick={a => setSelected(a.id)} empty={<Empty icon={Bot} title="No agents match" hint="Clear the filters, or spawn an agent to start work." action={<NeoButton variant="ghost" onClick={() => { setSearch(""); setState("all"); setTemplate("all"); setMine(false); }}>Clear filters</NeoButton>}/>}/>}</AsyncView></Card>
   <section className="neo-agents-templates"><SectionLabel actions={<NeoButton variant="ghost" size="sm" onClick={() => setEditing({ isNew:true, template:{id:`template_${crypto.randomUUID()}`,name:"",blurb:"",model:"neoproxy/default",restrictions:[]} })}><Plus size={12}/>New template</NeoButton>}>Templates</SectionLabel><div className="neo-grid-3">{templates.map(t => <Card key={t.id} title={t.name} description={t.blurb} className="neo-agents-template-card" footer={<><NeoButton variant="ghost" size="sm" onClick={() => setSpawning(t.id)}>Spawn from this</NeoButton><NeoButton variant="ghost" size="sm" onClick={() => setEditing({template:t,isNew:false})}>Edit</NeoButton></>}><span className="neo-mono neo-agents-template-model">{t.model}</span>{t.restrictions.length ? <RestrictionChips value={t.restrictions}/> : <p className="neo-agents-note">No restrictions. Same prompt, same tools, same everything as you.</p>}</Card>)}</div><Link className="neo-agents-studio" to="/studio"><Workflow size={13}/>Mixtures are built in Studio</Link></section>
  </div><JudgeFeed events={events} watching={(roster ?? []).filter(a => a.state !== "done").length} onChanged={refresh}/></div>
  {error && roster && <ErrorState error={error} onRetry={() => void refresh()}/>}
  <AgentDrawer key={selected} agent={roster?.find(a => a.id === selected) ?? null} onClose={() => setSelected(null)} onChanged={refresh}/>
  <SpawnAgentDrawer open={spawning !== null} initialTemplate={spawning ?? "worker"} onClose={() => setSpawning(null)} where={where.length ? where : undefined} onSpawn={spawn}/>
  {editing && <TemplateDrawer key={editing.template.id} template={editing.template} isNew={editing.isNew} onClose={() => setEditing(null)} onChanged={refresh}/>}
 </div>;
}
