import { Handle, MarkerType, Position, ReactFlowProvider, useReactFlow, useUpdateNodeInternals, type Connection, type Edge, type Node, type NodeProps, type OnNodesChange } from "@xyflow/react";
import { Bot, Cpu, Database, GitFork, HelpCircle, KanbanSquare, OctagonX, Plus, Route, Send, ShieldCheck, Shuffle, Workflow, X, Zap, TriangleAlert } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { GraphCanvasSurface } from "@/components/graph/GraphCanvasSurface";
import { Empty, SearchInput } from "@/components/neo";
import { graphProblems, type StudioGraph, type StudioNode } from "../../client/studio";
import { compatible, defaultConfig, NODE_TYPES, nodePorts, nodeType, type NodeType } from "./vocab";
const icons: Record<string, typeof Cpu> = { Bot, Cpu, Database, GitFork, HelpCircle, KanbanSquare, OctagonX, Route, Send, ShieldCheck, Shuffle, Zap };
interface CardData extends Record<string, unknown> { node: StudioNode; horizontal: boolean; problem?: string }
type CanvasNode = Node<CardData, "studio">;
export function nodeTitle(node: StudioNode): string { return String(node.config.name || nodeType(node.type)?.label || node.type); }
function summary(node: StudioNode): { body: string; mono?: boolean; extra?: string } {
 const c = node.config;
 if (node.type === "router.stage") {
  const accounts = c.accounts === "all" ? `${c.accountCount ?? "All"} accounts` : Array.isArray(c.accounts) ? `${c.accounts.filter(Boolean).length} accounts` : String(c.accounts || "No accounts");
  return { body: String(c.model ?? "Choose a model").split("/").at(-1)!, mono: true, extra: `${accounts} · ${c.draw ?? "alternate"}\n${c.perAccount ?? 0}% each, cap ${c.cap ?? 0}%/${c.per ?? "user"}/${c.window ?? "week"}` };
 }
 if (c.question) return { body: String(c.question), extra: String(c.model ?? "") };
 if (c.model) return { body: String(c.model), mono: true, extra: node.type === "bf.assign" ? String(c.template ?? "Worker") : undefined };
 return { body: String(c.virtualModel || c.message || c.comment || c.condition || c.column || c.label || c.thread || c.repository || c.board || c.path || c.url || c.template || c.sample || c.cron || c.filter || (node.type === "transform.merge" ? "Wait for all three reviews" : node.type === "bf.done" ? "Move the card to done" : "Select to configure")), mono: Boolean(c.virtualModel || c.path) };
}
const NodeCard = memo(function NodeCard({ id, data, selected }: NodeProps<CanvasNode>) {
 const type = nodeType(data.node.type); const Icon = icons[type?.icon ?? ""] ?? Workflow;
 const ports = nodePorts(data.node); const s = summary(data.node); const update = useUpdateNodeInternals();
 const signature = ports.outputs.map(p => p.id).join(",");
 useEffect(() => { update(id); }, [id, signature, update]);
 return <div className="neo-node neo-studio-node" data-selected={selected || undefined} data-problem={Boolean(data.problem) || undefined} data-horizontal={data.horizontal} data-branches={ports.outputs.length}>
 {ports.inputs.map((port, i) => <Handle key={port.id} type="target" position={data.horizontal ? Position.Left : Position.Top} id={port.id} aria-label={`${port.label} input, ${port.type}`} style={data.horizontal ? { top: `${(i + 1) / (ports.inputs.length + 1) * 100}%` } : { left: `${(i + 1) / (ports.inputs.length + 1) * 100}%` }} />)}
 <div className="neo-node-head"><span className="neo-node-icon" data-tone={type?.tone}><Icon size={14} /></span><div className="neo-node-titles"><div className="neo-node-title">{nodeTitle(data.node)}</div><div className="neo-node-kicker">{type?.label ?? data.node.type}</div></div></div>
 <div className="neo-node-body" data-mono={s.mono || undefined}>{s.body}{s.extra ? <span className="neo-studio-node-extra">{s.extra}</span> : null}</div>
 {data.problem ? <div className="neo-node-foot" data-tone="bad"><TriangleAlert size={12} />{data.problem}</div> : null}
 {ports.outputs.length > 1 ? <div className="neo-node-branches">{ports.outputs.map(port => <span key={port.id}>{port.label}</span>)}</div> : null}
 {ports.outputs.map((port, i) => <Handle key={port.id} type="source" position={data.horizontal ? Position.Right : Position.Bottom} id={port.id} aria-label={`${port.label} output, ${port.type}`} style={data.horizontal ? { top: `${(i + 1) / (ports.outputs.length + 1) * 100}%` } : { left: `${(i + .5) / ports.outputs.length * 100}%` }} />)}
 </div>;
});
const nodeTypes = { studio: NodeCard };
export function StudioCanvas(props: { graph: StudioGraph; selected: string | null; onSelect: (id: string | null) => void; onChange: (graph: StudioGraph) => void }) { return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>; }
function Canvas({ graph, selected, onSelect, onChange }: { graph: StudioGraph; selected: string | null; onSelect: (id: string | null) => void; onChange: (graph: StudioGraph) => void }) {
 const [palette, setPalette] = useState(false), [search, setSearch] = useState(""), [refusal, setRefusal] = useState("");
 const flow = useReactFlow<CanvasNode>(); const horizontal = graph.kind === "router";
 const problems = useMemo(() => graphProblems(graph), [graph]);
 const nodes = useMemo<CanvasNode[]>(() => graph.nodes.map(node => ({ id: node.id, type: "studio", position: node.position, selected: selected === node.id, ariaLabel: `${nodeTitle(node)}, ${nodeType(node.type)?.label}. Enter selects the node.`, data: { node, horizontal, problem: problems.find(p => p.nodeId === node.id)?.message } })), [graph.nodes, selected, problems, horizontal]);
 const edges = useMemo<Edge[]>(() => graph.edges.map(edge => {
  const source = graph.nodes.find(n => n.id === edge.from.node);
  const branch = source && nodePorts(source).outputs.length > 1;
  return { id: edge.id, source: edge.from.node, target: edge.to.node, sourceHandle: edge.from.port, targetHandle: edge.to.port, type: "smoothstep", pathOptions: { borderRadius: 18 }, label: branch ? edge.from.port : horizontal && source?.type === "router.stage" ? "demote" : undefined, markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "rgb(var(--ink-3))" }, style: { stroke: "rgb(var(--ink-4))", strokeWidth: 1.3 }, labelStyle: { fill: "rgb(var(--ink-2))", fontSize: 11.5 }, labelBgStyle: { fill: "var(--neo-panel)" }, labelBgPadding: [5, 3], labelBgBorderRadius: 5 };
 }), [graph.edges, graph.nodes, horizontal]);
 useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === "Escape") setPalette(false); }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, []);
 const changes: OnNodesChange<CanvasNode> = items => {
  let next = graph.nodes; let moved = false;
  for (const change of items) {
   if (change.type === "select" && change.selected) onSelect(change.id);
   if (change.type === "position" && change.position) { const position = change.position; next = next.map(n => n.id === change.id ? { ...n, position } : n); moved = true; }
   if (change.type === "remove") { next = next.filter(n => n.id !== change.id); moved = true; }
  }
  if (moved) onChange({ ...graph, nodes: next, edges: graph.edges.filter(e => next.some(n => n.id === e.from.node) && next.some(n => n.id === e.to.node)) });
 };
 function connect(connection: Connection): void {
  const source = graph.nodes.find(n => n.id === connection.source), target = graph.nodes.find(n => n.id === connection.target);
  if (!source || !target) return;
  const out = nodePorts(source).outputs.find(p => p.id === connection.sourceHandle), input = nodePorts(target).inputs.find(p => p.id === connection.targetHandle);
  if (!out || !input) return;
  if (!compatible(out, input)) { setRefusal(`Cannot connect ${out.type} to ${input.type}. Choose matching ports.`); return; }
  if (source.id === target.id) { setRefusal("A node cannot connect to itself. Choose another node."); return; }
  if (graph.edges.some(e => e.from.node === source.id && e.from.port === out.id && e.to.node === target.id && e.to.port === input.id)) return;
  setRefusal(""); onChange({ ...graph, edges: [...graph.edges, { id: crypto.randomUUID(), from: { node: source.id, port: out.id }, to: { node: target.id, port: input.id } }] });
 }
 function add(type: NodeType): void {
  const bounds = document.querySelector(".neo-studio-canvas")?.getBoundingClientRect();
  let position = flow.screenToFlowPosition({ x: bounds ? bounds.left + bounds.width / 2 - 112 : 300, y: bounds ? bounds.top + bounds.height / 2 - 55 : 300 });
  while (graph.nodes.some(n => Math.abs(n.position.x - position.x) < 240 && Math.abs(n.position.y - position.y) < 150)) position = { x: position.x + 40, y: position.y + 160 };
  const node: StudioNode = { id: crypto.randomUUID(), type: type.type, config: defaultConfig(type), position };
  onChange({ ...graph, nodes: [...graph.nodes, node] }); onSelect(node.id); setPalette(false); setSearch(""); void flow.setCenter(position.x + 112, position.y + 65, { zoom: Math.max(.8, flow.getZoom()), duration: 250 });
 }
 const available = NODE_TYPES.filter(n => n.kind === graph.kind && `${n.label} ${n.blurb}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="neo-studio-canvas">
 <GraphCanvasSurface<CanvasNode, Edge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={changes} onNodeClick={(_, node) => onSelect(node.id)} onPaneClick={() => { onSelect(null); setPalette(false); }} onConnect={connect} onEdgesDelete={deleted => onChange({ ...graph, edges: graph.edges.filter(e => !deleted.some(d => d.id === e.id)) })} fitView fitViewOptions={{ padding: .12, maxZoom: 1 }} minZoom={.3} nodesFocusable edgesFocusable deleteKeyCode={null} />
 {graph.nodes.length === 0 ? <div className="neo-studio-canvas-empty"><Empty icon={Workflow} title="Start with a node" hint="Add a trigger or an input, then connect what should happen next." /></div> : null}
 <div className="neo-studio-canvas-caption">{horizontal ? "Demotion runs left to right" : "Inputs above, outputs below"}<span>Drag a handle to connect</span></div>
 <button type="button" className="neo-canvas-pill neo-studio-add" onClick={() => setPalette(v => !v)} aria-expanded={palette}><Plus size={13} />Add node</button>
 {refusal || problems.length ? <button type="button" className="neo-canvas-pill neo-studio-problems" data-tone="bad" onClick={() => { if (refusal) setRefusal(""); else if (problems[0]?.nodeId) onSelect(problems[0].nodeId); }}><TriangleAlert size={12} />{refusal || `${problems.length} problem${problems.length === 1 ? "" : "s"}`}</button> : null}
 {palette ? <section className="neo-studio-palette" aria-label="Add a node"><header><strong>Add a node</strong><button className="neo-btn" data-variant="ghost" data-icon="true" type="button" aria-label="Close palette" onClick={() => setPalette(false)}><X size={14} /></button></header><SearchInput value={search} onChange={setSearch} placeholder="Search node types" autoFocus />
 <div className="neo-studio-palette-rows">{[...new Set(available.map(n => n.category))].map(category => <section key={category}><h3>{category}</h3>{available.filter(n => n.category === category).map(type => { const Icon = icons[type.icon] ?? Workflow; return <button key={type.type} type="button" onClick={() => add(type)}><span className="neo-node-icon" data-tone={type.tone}><Icon size={14} /></span><span><strong>{type.label}</strong><small>{type.blurb}</small></span><Plus size={12} /></button>; })}</section>)}{available.length === 0 ? <Empty title="No node types match" hint="Try a different search." /> : null}</div></section> : null}
 </div>;
}
