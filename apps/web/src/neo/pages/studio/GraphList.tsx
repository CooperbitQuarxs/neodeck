import { BookOpen, Clock, GitFork, KanbanSquare, Route, Workflow } from "lucide-react";
import { Empty, SearchInput, formatShortRelative } from "@/components/neo";
import type { GraphKind, GraphSummary } from "../../client/studio";
const groups: { kind: GraphKind; label: string; icon: typeof Workflow }[] = [{ kind: "flow", label: "Flows", icon: Clock }, { kind: "pipeline", label: "Pipelines", icon: Workflow }, { kind: "router", label: "Routers", icon: Route }, { kind: "classifier", label: "Classifiers", icon: GitFork }, { kind: "boardflow", label: "Board flows", icon: KanbanSquare }, { kind: "map", label: "Map", icon: BookOpen }];
export function GraphList({ graphs, selected, search, onSearch, onSelect }: { graphs: GraphSummary[]; selected: string; search: string; onSearch: (value: string) => void; onSelect: (id: string) => void }) {
 const needle = search.trim().toLowerCase();
 const visible = graphs.filter(g => `${g.name} ${g.description}`.toLowerCase().includes(needle));
 return <aside className="neo-split-list"><div className="neo-split-list-head"><SearchInput value={search} onChange={onSearch} placeholder="Search graphs" aria-label="Search graphs" /></div><div className="neo-split-rows">
 {groups.map(({ kind, label, icon: Icon }) => {
  const items = visible.filter(g => g.kind === kind);
  if (!items.length) return null;
  return <section key={kind} className={kind === "map" ? "neo-studio-map-row" : undefined}><h2 className="neo-split-group">{label}<span className="neo-num">{items.length}</span></h2>{items.map(g => <button key={g.id} type="button" className="neo-row" data-active={selected === g.id} data-settled={!g.enabled} onClick={() => onSelect(g.id)} aria-current={selected === g.id ? "page" : undefined}><span className="neo-row-lead"><Icon size={12} /></span><span className={`neo-row-title${kind === "router" ? " neo-mono" : ""}`}>{kind === "router" ? `neoproxy/${g.name.replace(/^neoproxy\//, "")}` : g.name}</span><span className="neo-row-when">{kind === "map" ? "live" : g.lastRun ? formatShortRelative(g.lastRun.at) : "never"}</span><span className="neo-row-sub">{g.description}</span></button>)}</section>;
 })}
 {visible.length === 0 ? <Empty title="No matching graphs" hint="Clear the search or create a new graph." /> : null}
 </div><div className="neo-studio-list-foot"><Workflow size={12} /><span>{graphs.filter(g => g.kind !== "map").length} graphs in the office</span></div></aside>;
}
