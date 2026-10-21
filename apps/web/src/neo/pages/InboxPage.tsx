/**
 * Inbox: where everything lands before it is work. Today strip on top,
 * list on the left, the open item on the right with the classifier's
 * proposal as one line you accept or edit, and the capture bar pinned to
 * the bottom at a fixed height. See docs/design/neodeck-architecture.md §4.
 */
import { ArrowUpRight, Check, Inbox as InboxIcon } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { InboxItem, InboxKind } from "@npi-deck/protocol";
import { Empty, ErrorState, formatRelativeTime, formatShortRelative, NeoBadge, NeoButton, NeoSelect, SearchInput, Segmented, Stat, StatGrid } from "@/components/neo";
import { Markdown } from "@/lib/markdown";
import { inboxApi } from "@/lib/inbox-api";
import { useStore } from "@/lib/store";
import { usePresence } from "../client/presence";
import { type Destination, type Proposal, proposalFor } from "../client/preview-data";
import { PreviewChip } from "../components/PreviewChip";

const KINDS: readonly InboxKind[] = ["capture", "ticket", "idea", "decision", "investigation", "email"];
type Filter = "unread" | "all" | "done";

export function InboxPage() {
	const [items, setItems] = useState<InboxItem[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<Filter>("unread");
	const [search, setSearch] = useState("");
	const [params, setParams] = useSearchParams();
	const openId = params.get("item");
	const presence = usePresence();
	const tasksCounter = useStore((s) => s.tasksChangeCounter);

	const refresh = useCallback(async () => {
		try {
			const res = await inboxApi.list({ includeProcessed: true });
			setItems(res.items);
			setError(null);
		} catch (e) {
			setError(String(e));
		}
	}, []);
	useEffect(() => {
		void refresh();
	}, [refresh, tasksCounter]);

	const visible = useMemo(() => {
		const needle = search.trim().toLowerCase();
		return (items ?? [])
			.filter((i) => (filter === "all" ? true : filter === "done" ? Boolean(i.processedAt) : !i.processedAt))
			.filter((i) => needle === "" || i.title.toLowerCase().includes(needle) || i.body.toLowerCase().includes(needle))
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}, [items, filter, search]);
	const open = items?.find((i) => i.id === openId) ?? null;
	const unread = items?.filter((i) => !i.processedAt).length ?? 0;
	const counts = { unread, all: items?.length ?? 0, done: (items?.length ?? 0) - unread };

	function select(id: string | null): void {
		setParams((prev) => {
			const next = new URLSearchParams(prev);
			if (id) next.set("item", id);
			else next.delete("item");
			return next;
		});
	}

	async function capture(title: string, kind: InboxKind): Promise<void> {
		const created = await inboxApi.create({ title, kind });
		await refresh();
		select(created.id);
	}

	async function markDone(item: InboxItem, done: boolean): Promise<void> {
		await inboxApi.update(item.id, { processed: done });
		await refresh();
	}

	return (
		<div className="neo-inbox">
			<div className="neo-inbox-today">
				<StatGrid>
					<Stat size="sm" label="Need you" value={presence.needsYou} foot="threads and agents waiting" to="/threads?filter=needs-you" />
					<Stat size="sm" label="Working" value={presence.working} foot="agents on cards and threads" to="/agents" />
					<Stat size="sm" label="In review" value={presence.inReview} foot="pull requests open" to="/github" />
					<Stat size="sm" label="Unread" value={items ? unread : "–"} foot={items ? `${items.length} in the inbox` : "loading"} />
				</StatGrid>
			</div>

			<div className="neo-inbox-body">
				<aside className="neo-inbox-list">
					<div className="neo-inbox-list-head">
						<SearchInput value={search} onChange={setSearch} placeholder="Search the inbox" size="sm" aria-label="Search the inbox" />
						<Segmented
							label="Show"
							value={filter}
							onChange={setFilter}
							options={[
								{ value: "unread", label: <>Unread <span className="neo-num">{counts.unread}</span></> },
								{ value: "all", label: <>All <span className="neo-num">{counts.all}</span></> },
								{ value: "done", label: <>Done <span className="neo-num">{counts.done}</span></> },
							]}
						/>
					</div>
					{error ? <ErrorState error={error} onRetry={() => void refresh()} className="m-3" /> : null}
					{items && visible.length === 0 ? (
						<Empty icon={InboxIcon} title={filter === "unread" ? "Inbox zero" : "Nothing matches"} hint={filter === "unread" ? "Capture a thought below and it lands here." : "Clear the search or switch the filter."} />
					) : (
						<ul className="neo-inbox-rows" role="list">
							{visible.map((item) => (
								<li key={item.id}>
									<button type="button" className="neo-inbox-row" data-active={item.id === openId} data-settled={Boolean(item.processedAt)} onClick={() => select(item.id)}>
										<span className="neo-dot neo-inbox-row-dot" data-kind={item.kind} />
										<span className="neo-inbox-row-title">{item.title}</span>
										<span className="neo-inbox-row-when neo-num">{formatShortRelative(item.createdAt)}</span>
										<span className="neo-inbox-row-sub">
											{item.kind}
											{item.source ? ` · ${item.source}` : ""}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</aside>

				<section className="neo-inbox-detail">
					{open ? (
						<ItemView item={open} onDone={(done) => void markDone(open, done)} onChanged={() => void refresh()} />
					) : (
						<Empty icon={InboxIcon} title={items && unread > 0 ? "Open an item" : "Nothing waiting"} hint={items && unread > 0 ? "Read it, accept where it goes, or send it somewhere else." : "The office is quiet. Capture the next thing below."} />
					)}
				</section>
			</div>

			<CaptureBar onCapture={capture} />
		</div>
	);
}

function ItemView({ item, onDone, onChanged }: { item: InboxItem; onDone: (done: boolean) => void; onChanged: () => void }) {
	const proposal = useMemo(() => proposalFor(item), [item]);
	const [editing, setEditing] = useState(false);
	const [dest, setDest] = useState<Destination>(proposal.destination);
	const [receipt, setReceipt] = useState<string | null>(null);
	useEffect(() => {
		setDest(proposal.destination);
		setEditing(false);
		setReceipt(null);
	}, [proposal]);

	async function accept(): Promise<void> {
		if (dest.kind === "card") {
			const res = await inboxApi.promote(item.id, {});
			setReceipt(`Card T-${res.task.displayId} created on the board.`);
			onChanged();
			return;
		}
		setReceipt(`${describe(dest)}: filed. This destination is preview until its backend lands.`);
	}

	return (
		<div className="neo-item">
			<header className="neo-item-head">
				<div className="min-w-0">
					<h1 className="neo-reader-title">{item.title}</h1>
					<div className="neo-item-meta">
						<NeoBadge mono>{item.kind}</NeoBadge>
						{item.source ? <NeoBadge>{item.source}</NeoBadge> : null}
						<span title={new Date(item.createdAt).toLocaleString()}>{formatRelativeTime(item.createdAt)}</span>
						{item.processedAt ? <span>· done {formatRelativeTime(item.processedAt)}</span> : null}
					</div>
				</div>
				<div className="neo-item-actions">
					<NeoButton size="sm" variant={item.processedAt ? "ghost" : undefined} onClick={() => onDone(!item.processedAt)}>
						<Check size={13} /> {item.processedAt ? "Reopen" : "Done"}
					</NeoButton>
				</div>
			</header>

			<div className="neo-item-body">{item.body.trim() ? <Markdown>{item.body}</Markdown> : <p className="neo-dim">No notes yet.</p>}</div>

			<div className="neo-proposal" data-tone={receipt ? "ok" : undefined}>
				<div className="neo-section-label">
					<span>Where it goes</span>
					<PreviewChip domains={["classifier"]} what="The classifier's proposal" />
				</div>
				{receipt ? (
					<p className="neo-proposal-line">
						<Check size={14} /> {receipt}
					</p>
				) : editing ? (
					<DestinationEditor value={dest} onChange={setDest} />
				) : (
					<p className="neo-proposal-line">
						<span className="neo-cell-primary">{describe(dest)}</span>
						<span className="neo-dim">
							{" "}
							· {Math.round(proposal.confidence * 100)}% sure · {proposal.reason}
						</span>
					</p>
				)}
				{!receipt ? (
					<div className="flex items-center gap-2">
						<NeoButton size="sm" variant="primary" onClick={() => void accept()}>
							<ArrowUpRight size={13} /> {editing ? "Send there" : "Accept"}
						</NeoButton>
						<NeoButton size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
							{editing ? "Back to the proposal" : "Somewhere else"}
						</NeoButton>
					</div>
				) : (
					<Link to={dest.kind === "card" ? "/board" : dest.kind === "issue" ? "/github" : dest.kind === "thread" ? "/threads" : "/knowledge"} className="neo-btn" data-size="sm">
						Open {dest.kind === "card" ? "the board" : dest.kind === "issue" ? "GitHub" : dest.kind === "thread" ? "the thread" : "the note"}
					</Link>
				)}
			</div>
		</div>
	);
}

function describe(d: Destination): string {
	switch (d.kind) {
		case "card":
			return `Board › ${d.project} › ${d.column}`;
		case "issue":
			return `GitHub issue in ${d.repo}`;
		case "thread":
			return `A thread with a ${d.agent}`;
		case "note":
			return `Knowledge › ${d.path}`;
	}
}

function DestinationEditor({ value, onChange }: { value: Destination; onChange: (d: Destination) => void }) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<NeoSelect
				size="sm"
				aria-label="Destination kind"
				value={value.kind}
				onChange={(e) => {
					const kind = e.target.value as Destination["kind"];
					onChange(kind === "card" ? { kind, project: "atlas", column: "backlog" } : kind === "issue" ? { kind, repo: "atlas" } : kind === "thread" ? { kind, agent: "Worker" } : { kind, path: "inbox/" });
				}}
			>
				<option value="card">Board card</option>
				<option value="issue">GitHub issue</option>
				<option value="thread">Thread with an agent</option>
				<option value="note">Knowledge note</option>
			</NeoSelect>
			{value.kind === "card" ? (
				<NeoSelect size="sm" aria-label="Column" value={value.column} onChange={(e) => onChange({ ...value, column: e.target.value })}>
					{["backlog", "active", "blocked", "done"].map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</NeoSelect>
			) : null}
			{value.kind === "thread" ? (
				<NeoSelect size="sm" aria-label="Agent template" value={value.agent} onChange={(e) => onChange({ ...value, agent: e.target.value })}>
					{["Worker", "Advisor", "Blank"].map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</NeoSelect>
			) : null}
		</div>
	);
}

/** Fixed-height capture bar: title, kind, enter. Always there, always the same size. */
function CaptureBar({ onCapture }: { onCapture: (title: string, kind: InboxKind) => Promise<void> }) {
	const [title, setTitle] = useState("");
	const [kind, setKind] = useState<InboxKind>("capture");
	const [busy, setBusy] = useState(false);
	async function submit(e: FormEvent): Promise<void> {
		e.preventDefault();
		if (!title.trim()) return;
		setBusy(true);
		try {
			await onCapture(title.trim(), kind);
			setTitle("");
		} finally {
			setBusy(false);
		}
	}
	return (
		<form className="neo-capture" onSubmit={(e) => void submit(e)}>
			<input className="neo-input neo-capture-input" placeholder="Capture a thought, a ticket, a decision… enter files it" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Capture" />
			<NeoSelect aria-label="Kind" value={kind} onChange={(e) => setKind(e.target.value as InboxKind)} mono>
				{KINDS.map((k) => (
					<option key={k} value={k}>
						{k}
					</option>
				))}
			</NeoSelect>
			<NeoButton type="submit" variant="primary" disabled={busy || !title.trim()}>
				Capture
			</NeoButton>
		</form>
	);
}
