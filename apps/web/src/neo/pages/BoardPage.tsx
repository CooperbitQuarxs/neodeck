import "./board.css";
import { GitBranch, Inbox, KanbanSquare, MessagesSquare, Plus, Settings2, Workflow } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Dot, Empty, ErrorState, formatShortRelative, NeoBadge, NeoButton, NeoSelect, PageHeader, SearchInput, Skeleton, Toolbar } from "@/components/neo";
import { projectLabel } from "@/lib/kanban-project";
import { useStore } from "@/lib/store";
import { useAccount } from "../client/auth";
import { board, type BoardCard, type BoardColumn } from "../client/board";
import { AgentSwatch, agentColor } from "../components/AgentSwatch";
import { Avatar } from "../components/Avatar";
import { PreviewChip } from "../components/PreviewChip";
import { NAV_ITEMS } from "../nav";
import { CardDrawer } from "./board/CardDrawer";
import { ColumnsDrawer, NewCardDrawer } from "./board/Editors";

const nav = NAV_ITEMS.find((item) => item.to === "/board")!;
export const activeRun = (card: BoardCard) => card.run?.status === "running" || card.run?.status === "queued";

export function BoardPage() {
	const [cards, setCards] = useState<BoardCard[] | null>(null);
	const [columns, setColumns] = useState<BoardColumn[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [project, setProject] = useState("all");
	const [holder, setHolder] = useState("anyone");
	const [archived, setArchived] = useState(false);
	const [editor, setEditor] = useState<"columns" | "new" | null>(null);
	const [dropColumn, setDropColumn] = useState<string | null>(null);
	const [params, setParams] = useSearchParams();
	const selected = params.get("card") ?? params.get("open");
	const account = useAccount();
	const counter = useStore((s) => s.tasksChangeCounter);
	const sequence = useRef(0);
	const refresh = useCallback(async () => {
		const seq = ++sequence.current;
		try {
			const [nextColumns, nextCards] = await Promise.all([board.columns(), board.cards({ archived: true })]);
			if (sequence.current !== seq) return;
			setColumns(nextColumns); setCards(nextCards); setError(null);
		} catch (err) { if (sequence.current === seq) setError(`Could not load the board. ${String(err)}`); }
	}, []);
	useEffect(() => { void refresh(); }, [refresh, counter]);
	const projects = useMemo(() => [...new Set((cards ?? []).flatMap((card) => card.cwd ? [card.cwd] : []))].sort(), [cards]);
	const visible = useMemo(() => (cards ?? []).filter((card) => {
		if (!archived && card.archived) return false;
		if (project === "unassigned" ? Boolean(card.cwd) : project !== "all" && card.cwd !== project.slice(4)) return false;
		if (holder === "me" && !(card.holder?.kind === "person" && card.holder.handle === account?.handle)) return false;
		if (holder === "agents" && !card.run) return false;
		if (holder === "unassigned" && (card.holder || card.run)) return false;
		return `${card.title}\nT-${card.number}\n${card.body}`.toLowerCase().includes(search.trim().toLowerCase());
	}), [cards, archived, project, holder, search, account?.handle]);
	const open = cards?.find((card) => card.id === selected || `T-${card.number}` === selected);
	function select(id: string | null) {
		setParams((prev) => { const next = new URLSearchParams(prev); next.delete("open"); if (id) next.set("card", id); else next.delete("card"); return next; });
	}
	async function move(id: string, columnId: string) {
		try { await board.move(id, columnId); await refresh(); }
		catch (err) { setError(`Could not move the card. ${String(err)}`); }
	}
	return <div className="neo-fill neo-board-page">
		<PageHeader title={nav.label} description={nav.blurb} badge={<PreviewChip domains={["boardEvidence"]} what="Person holders, richer evidence and linked work" />} actions={<NeoButton variant="primary" onClick={() => setEditor("new")} disabled={!columns.length}><Plus size={14} /> New card</NeoButton>} />
		<Toolbar className="neo-board-toolbar" end={<><Check checked={archived} onChange={setArchived}>Show archived</Check><NeoButton onClick={() => setEditor("columns")}><Settings2 size={13} /> Columns</NeoButton></>}>
			<SearchInput value={search} onChange={setSearch} placeholder="Search cards…" aria-label="Search cards" width={240} />
			<NeoSelect aria-label="Project filter" value={project} onChange={(e) => setProject(e.target.value)}><option value="all">Project: All</option><option value="unassigned">Unassigned</option>{projects.map((cwd) => <option key={cwd} value={`cwd:${cwd}`}>{projectLabel(cwd)}</option>)}</NeoSelect>
			<NeoSelect aria-label="Holder filter" value={holder} onChange={(e) => setHolder(e.target.value)}><option value="anyone">Holder: Anyone</option><option value="me">Me</option><option value="agents">Agents</option><option value="unassigned">Unassigned</option></NeoSelect>
		</Toolbar>
		{error && <ErrorState error={error} onRetry={() => void refresh()} />}
		{cards === null ? <div className="neo-board neo-fill-body">{[0, 1, 2, 3].map((i) => <div className="neo-board-column" key={i}><Skeleton height={36} /><div className="neo-board-column-body"><Skeleton height={105} /><Skeleton height={88} /></div></div>)}</div> : columns.length === 0 ? <Empty icon={KanbanSquare} title="Give the work a place" hint="Add your first column, then create a card." action={<NeoButton onClick={() => setEditor("columns")}>Add a column</NeoButton>} /> : <>
			{visible.length === 0 && <div className="neo-board-filter-note" role="status">{cards.length === 0 ? "No cards yet. Create the first card to start the board." : "No cards match. Clear the search or change the filters."}</div>}
			<div className="neo-board neo-fill-body" aria-label="Task board">{columns.map((column) => {
				const inColumn = visible.filter((card) => card.columnId === column.id);
				return <section key={column.id} className="neo-board-column" data-drop={dropColumn === column.id} aria-label={column.name} onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-neo-card")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropColumn(column.id); } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropColumn(null); }} onDrop={(e) => { e.preventDefault(); setDropColumn(null); const id = e.dataTransfer.getData("application/x-neo-card"); if (cards.some((card) => card.id === id)) void move(id, column.id); }}>
					<header className="neo-board-column-head"><h2>{column.name}</h2><span className="neo-num">{inColumn.length}</span>{inColumn.some(activeRun) && <Dot tone="live" pulse />}</header>
					<div className="neo-board-column-body">{inColumn.map((card) => <Card key={card.id} card={card} onOpen={() => select(card.id)} onDragEnd={() => setDropColumn(null)} />)}{inColumn.length === 0 && <p className="neo-board-column-empty">{search || project !== "all" || holder !== "anyone" ? "No matching cards" : "Drop a card here"}</p>}</div>
				</section>;
			})}</div>
		</>}
		{open && <CardDrawer key={open.id} card={open} columns={columns} onClose={() => select(null)} onChanged={refresh} onRemoved={() => { select(null); void refresh(); }} />}
		{editor === "columns" && <ColumnsDrawer columns={columns} onClose={() => setEditor(null)} onChanged={refresh} />}
		{editor === "new" && <NewCardDrawer columns={columns} projects={projects} initialProject={project.startsWith("cwd:") ? project.slice(4) : ""} onClose={() => setEditor(null)} onCreated={async (card) => { await refresh(); setEditor(null); select(card.id); }} />}
	</div>;
}

function Card({ card, onOpen, onDragEnd }: { card: BoardCard; onOpen: () => void; onDragEnd: () => void }) {
	const Icon = { inbox: Inbox, github: GitBranch, thread: MessagesSquare, routine: Workflow, manual: null }[card.origin.kind];
	return <button type="button" className="neo-board-card" draggable onDragStart={(e) => { e.dataTransfer.setData("application/x-neo-card", card.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={onDragEnd} onClick={onOpen} data-running={activeRun(card)} data-failed={card.run?.status === "failed"} data-archived={card.archived} style={{ "--agent": agentColor(card.holder?.hue ?? 40) } as CSSProperties}>
		<span className="neo-board-card-meta"><span className="neo-mono">T-{card.number}</span><NeoBadge mono title={card.cwd}>{projectLabel(card.cwd)}</NeoBadge>{card.archived && <NeoBadge>archived</NeoBadge>}</span>
		<span className="neo-board-card-title">{card.title}</span>
		{activeRun(card) && card.holder?.kind === "agent" ? <span className="neo-board-holder"><AgentSwatch hue={card.holder.hue} name={card.holder.name} /><Dot tone="live" /></span> : card.holder?.kind === "person" ? <span className="neo-board-holder"><Avatar account={card.holder} size={16} />{card.holder.name}</span> : null}
		<span className="neo-board-card-evidence" title={card.evidence?.text ?? (card.run?.status === "failed" ? card.run.error : undefined)}>{Icon && <Icon size={12} />}<span>{card.origin.kind === "manual" ? "" : `${card.origin.ref ?? card.origin.kind} · `}{card.evidence?.text ?? (card.run ? `run ${card.run.status}` : "updated")}</span><time dateTime={card.evidence?.at ?? card.updatedAt}>{formatShortRelative(card.evidence?.at ?? card.updatedAt)}</time></span>
	</button>;
}
