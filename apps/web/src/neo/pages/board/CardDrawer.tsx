import { Archive, GitBranch, MessagesSquare, RotateCcw, Trash2, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MarkdownEdit } from "@/components/MarkdownEdit";
import { Drawer, ErrorState, formatRelativeTime, formatShortRelative, formatTimestamp, NeoBadge, NeoButton, NeoLinkButton, NeoSelect, SectionLabel } from "@/components/neo";
import { projectLabel } from "@/lib/kanban-project";
import { Markdown } from "@/lib/markdown";
import { useAccount } from "../../client/auth";
import { board, boardEvidence, type BoardCard, type BoardColumn, type BoardEvent, type BoardLinks } from "../../client/board";
import { SOURCES } from "../../client/source";
import { AgentSwatch } from "../../components/AgentSwatch";
import { Avatar } from "../../components/Avatar";
import { ModelPicker } from "../../components/ModelPicker";
import { PreviewChip } from "../../components/PreviewChip";

export function CardDrawer({ card, columns, onClose, onChanged, onRemoved }: { card: BoardCard; columns: BoardColumn[]; onClose: () => void; onChanged: () => Promise<void>; onRemoved: () => void }) {
	const [events, setEvents] = useState<BoardEvent[] | null>(null);
	const [links, setLinks] = useState<BoardLinks>({});
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [editingTitle, setEditingTitle] = useState(false);
	const [title, setTitle] = useState(card.title);
	const [editingBody, setEditingBody] = useState(false);
	const [body, setBody] = useState(card.body);
	const [assigning, setAssigning] = useState(false);
	const [model, setModel] = useState("neoproxy/heavy");
	const [confirmDelete, setConfirmDelete] = useState(false);
	const account = useAccount();
	const run = card.run;
	const running = run?.status === "running" || run?.status === "queued";
	useEffect(() => { setTitle(card.title); }, [card.title]);
	useEffect(() => { if (!editingBody) setBody(card.body); }, [card.body, editingBody]);
	useEffect(() => {
		let cancelled = false;
		void Promise.all([board.events(card.id), board.links(card.id)]).then(([nextEvents, nextLinks]) => { if (!cancelled) { setEvents(nextEvents); setLinks(nextLinks); } }).catch((err: unknown) => { if (!cancelled) setError(`Could not load card evidence. ${String(err)}`); });
		return () => { cancelled = true; };
	}, [card]);
	useEffect(() => { if (!confirmDelete) return; const timer = setTimeout(() => setConfirmDelete(false), 4000); return () => clearTimeout(timer); }, [confirmDelete]);
	async function act(action: () => Promise<unknown>): Promise<boolean> {
		if (busy) return false;
		setBusy(true); setError(null);
		try { await action(); await onChanged(); return true; }
		catch (err) { setError(`The card was not changed. ${String(err)}`); return false; }
		finally { setBusy(false); }
	}
	async function saveTitle() {
		if (!title.trim()) { setTitle(card.title); setEditingTitle(false); return; }
		if (title.trim() === card.title || await act(() => board.update(card.id, { title: title.trim() }))) setEditingTitle(false);
	}
	const thread = `/threads?card=T-${card.number}`;
	const holder = card.holder;
	return <Drawer open onClose={onClose} width={600} title={editingTitle ? <input className="neo-input neo-board-title-input" aria-label="Card title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => void saveTitle()} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} autoFocus /> : <button type="button" className="neo-board-edit-title" title="Edit title" onClick={() => setEditingTitle(true)}>{card.title}</button>} subtitle={`T-${card.number} · ${projectLabel(card.cwd)} · ${columns.find((c) => c.id === card.columnId)?.name ?? "Unknown column"} · created ${formatRelativeTime(card.createdAt)}`} footer={<div className="neo-board-drawer-footer">
		<div className="neo-board-actions"><NeoButton size="sm" variant="ghost" disabled={busy} onClick={() => void act(() => board.update(card.id, { archived: !card.archived }))}>{card.archived ? <RotateCcw size={13} /> : <Archive size={13} />}{card.archived ? "Restore" : "Archive"}</NeoButton><NeoButton size="sm" variant="danger" disabled={busy} onClick={() => { if (!confirmDelete) { setConfirmDelete(true); return; } void act(async () => { await board.remove(card.id); onRemoved(); }); }}><Trash2 size={13} />{confirmDelete ? "Delete for good?" : "Delete"}</NeoButton></div>
		<div className="neo-board-actions"><NeoSelect size="sm" aria-label="Move card to column" value={card.columnId} disabled={busy} onChange={(e) => void act(() => board.move(card.id, e.target.value))}>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</NeoSelect><NeoLinkButton to={`${thread}&draft=${encodeURIComponent(card.title)}`} size="sm" variant="ghost">Open in thread</NeoLinkButton></div>
	</div>}>
		<div className="neo-board-detail">
			{error && <ErrorState error={error} />}
			<section><SectionLabel actions={!editingBody && <NeoButton size="sm" variant="ghost" onClick={() => { setBody(card.body); setEditingBody(true); }}>Edit</NeoButton>}>Body</SectionLabel>{editingBody ? <><div className="neo-board-markdown-editor"><MarkdownEdit value={body} onChange={setBody} onDraftChange={setBody} autoEdit autoFocus placeholder="Add instructions, notes or acceptance criteria…" /></div><div className="neo-board-actions"><NeoButton size="sm" variant="primary" disabled={busy} onClick={() => { void act(() => board.update(card.id, { body })).then((saved) => { if (saved) setEditingBody(false); }); }}>Save</NeoButton><NeoButton size="sm" variant="ghost" onClick={() => setEditingBody(false)}>Cancel</NeoButton></div></> : card.body.trim() ? <div className="neo-board-markdown"><Markdown>{card.body}</Markdown></div> : <p className="neo-dim">No notes yet. Edit the body to add the work and its acceptance criteria.</p>}</section>
			<section><SectionLabel>Holder</SectionLabel>{run ? <div className="neo-board-run">
				<div className="neo-board-holder"><AgentSwatch hue={holder?.hue ?? 40} name={holder?.name ?? "Worker"} /><NeoBadge tone={run.status === "failed" ? "bad" : run.status === "completed" ? "ok" : run.status === "queued" || run.status === "cancelled" ? "warn" : undefined}>{run.status}</NeoBadge><span className="neo-board-since">since {formatShortRelative(run.startedAt ?? run.assignedAt)}</span></div>
				<div className="neo-mono neo-board-model">{holder?.kind === "agent" ? holder.model : run.model ?? "Deck default"}</div>
				{run.outcome && <p className="neo-board-outcome">{run.outcome}</p>}{run.error && <p className="neo-board-run-error" role="status">{run.error}</p>}
			</div> : holder?.kind === "person" ? <div className="neo-board-holder"><Avatar account={holder} />{holder.name}<span className="neo-dim">@{holder.handle}</span></div> : <p className="neo-dim">Nobody holds this card. Assign to agent, or claim it.</p>}
				<div className="neo-board-actions">{running ? <NeoButton variant="danger" size="sm" disabled={busy} onClick={() => void act(() => board.cancel(card.id))}>Stop run</NeoButton> : <NeoButton variant="primary" size="sm" onClick={() => setAssigning((value) => !value)} disabled={busy}>Assign to agent</NeoButton>}{!run && !holder && account && SOURCES.boardEvidence === "preview" && <NeoButton size="sm" variant="ghost" onClick={() => void act(() => boardEvidence.claim(card.id, account))} disabled={busy}>Claim</NeoButton>}</div>
				{assigning && !running && <div className="neo-board-assignment"><div className="neo-board-actions"><ModelPicker value={model} onChange={setModel} /><NeoButton size="sm" variant="primary" disabled={busy} onClick={() => { void act(() => board.assign(card.id, model)).then((started) => { if (started) setAssigning(false); }); }}>{busy ? "Starting…" : "Start"}</NeoButton></div>{SOURCES.board === "live" && <p className="neo-board-help">This deck starts runs with the card's YAML model or its default. Model selection is preview until the assignment API accepts it.</p>}</div>}
			</section>
			<section><SectionLabel actions={<PreviewChip domains={["boardEvidence"]} what="Extra timeline receipts" />}>Timeline</SectionLabel>{events === null ? <p className="neo-dim">Loading the card's receipts…</p> : <ol className="neo-board-events">{events.map((event) => <li key={event.id} data-tone={event.tone}><i aria-hidden="true" /><time title={formatTimestamp(event.at)} dateTime={event.at}>{formatShortRelative(event.at)}</time><span>{event.actor && <strong>{event.actor} </strong>}{event.text}</span></li>)}</ol>}</section>
			<section><SectionLabel>Links</SectionLabel><div className="neo-board-links">{(["issue", "pr"] as const).map((kind) => { const ref = links[kind]; if (!ref) return null; const label = `${ref.repo} ${kind === "pr" ? "PR" : "issue"} #${ref.number}`; return ref.url ? <a key={kind} className="neo-chip" href={ref.url} target="_blank" rel="noreferrer"><GitBranch size={12} />{label}</a> : <Link key={kind} className="neo-chip" to={`/github?repo=${encodeURIComponent(ref.repo)}&${kind}=${ref.number}`}><GitBranch size={12} />{label}</Link>; })}<Link className="neo-chip" to={thread}><MessagesSquare size={12} />Open thread</Link>{links.flow && <Link className="neo-chip" to={`/studio?graph=${links.flow.id}`}><Workflow size={12} />{links.flow.name}</Link>}</div></section>
		</div>
	</Drawer>;
}
