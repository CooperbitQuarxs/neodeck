import { useRef, useState } from "react";
import { Check } from "lucide-react";
import type { InboxItem, InboxKind } from "@npi-deck/protocol";
import { MarkdownEdit } from "../MarkdownEdit";
import { inboxApi } from "../../lib/inbox-api";

export const KIND_ORDER: ReadonlyArray<InboxKind> = [
	"capture",
	"idea",
	"investigation",
	"decision",
	"ticket",
	"email",
];

export const KIND_LABEL: Record<InboxKind, string> = {
	email: "emails",
	ticket: "tickets",
	idea: "ideas",
	decision: "decisions",
	investigation: "investigations",
	capture: "captures",
};

export function ComposePane({
	onClose,
	onCreated,
}: {
	onClose: () => void;
	onCreated: (item: InboxItem) => void;
}) {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	// Capture may activate without blurring the markdown editor first.
	const bodyDraft = useRef("");
	const [kind, setKind] = useState<InboxKind>("capture");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | undefined>();

	async function submit(): Promise<void> {
		const t = title.trim();
		if (!t) return;
		setBusy(true);
		setErr(undefined);
		try {
			const created = await inboxApi.create({ kind, title: t, body: bodyDraft.current });
			onCreated(created);
		} catch (e) {
			setErr(String(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-paper px-4">
				<select
					value={kind}
					onChange={(e) => setKind(e.target.value as InboxKind)}
					className="field h-7 px-2 font-mono text-2xs uppercase tracking-meta"
				>
					{KIND_ORDER.map((k) => (
						<option key={k} value={k}>
							{KIND_LABEL[k]}
						</option>
					))}
				</select>
				<div className="ml-auto flex items-center gap-1.5">
					<button type="button" onClick={onClose} className="btn-ghost h-8 px-3 text-sm">
						Cancel
					</button>
					<button
						type="button"
						onClick={() => void submit()}
						disabled={busy || !title.trim()}
						className="btn-primary h-8 px-3 text-sm"
					>
						<Check className="h-4 w-4" />
						Capture
					</button>
				</div>
			</div>

			<div className="border-b border-line px-6 pt-5 pb-3">
				<input
					autoFocus
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					onKeyDown={(e) => {
						if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void submit();
					}}
					placeholder="Title — short summary of the thought"
					className="w-full bg-transparent text-xl font-semibold text-ink placeholder:text-ink-4 focus:outline-none"
				/>
				<div className="mt-1 font-mono text-2xs text-ink-3">
					⌘+enter to save · esc to cancel
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
				<MarkdownEdit
					value={body}
					onChange={setBody}
					onDraftChange={(next) => { bodyDraft.current = next; }}
					autoEdit
					placeholder="Body — details, context, links… (markdown supported)"
				/>
			</div>

			{err ? (
				<div className="border-t border-line bg-danger/10 px-4 py-1.5 text-xs text-danger">
					{err}
				</div>
			) : null}
		</div>
	);
}
