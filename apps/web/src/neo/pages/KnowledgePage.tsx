import "./knowledge.css";
import { BookOpen, Network, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { KbBacklink, KbFileResponse, KbGraphResponse, KbSearchResponse, KbTreeResponse } from "@npi-deck/protocol";
import { Card, Empty, ErrorState, Kbd, NeoButton, PageHeader, SearchInput, SectionLabel, Segmented, TableSkeleton } from "@/components/neo";
import type { KbStatusResponse } from "@/lib/kb-api";
import { useStore } from "@/lib/store";
import { knowledge, type KnowledgeHistoryEntry } from "../client/knowledge";
import { PreviewChip } from "../components/PreviewChip";
import { dirColor } from "../components/KnowledgeMap";
import { NAV_ITEMS } from "../nav";
import { NoteList } from "./knowledge/NoteList";
import { NoteMap } from "./knowledge/NoteMap";
import { fileTitle, NoteReader } from "./knowledge/NoteReader";

const MAP_KEY = "neodeck.knowledge.map";
const nav = NAV_ITEMS.find((item) => item.to === "/knowledge")!;
function mapDefault(): boolean { try { return localStorage.getItem(MAP_KEY) !== "false"; } catch { return true; } }

export function KnowledgePage() {
	const [params, setParams] = useSearchParams();
	const navigate = useNavigate();
	const path = params.get("note") ?? undefined;
	const query = params.get("q") ?? "";
	const [mapOpen, setMapOpen] = useState(mapDefault);
	const [hops, setHops] = useState<"1" | "2" | "0">("2");
	const [mode, setMode] = useState<"tree" | "recent">("tree");
	const [tree, setTree] = useState<KbTreeResponse | null>(null);
	const [status, setStatus] = useState<KbStatusResponse | null>(null);
	const [graph, setGraph] = useState<KbGraphResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [retry, setRetry] = useState(0);
	const [file, setFile] = useState<KbFileResponse | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const [backlinks, setBacklinks] = useState<KbBacklink[]>([]);
	const [relatedError, setRelatedError] = useState<string | null>(null);
	const [history, setHistory] = useState<KnowledgeHistoryEntry[]>([]);
	const [historyError, setHistoryError] = useState<string | null>(null);
	const [titles, setTitles] = useState<Record<string, string>>({});
	const [results, setResults] = useState<KbSearchResponse | null>(null);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [unresolved, setUnresolved] = useState<string | null>(null);
	const counter = useStore((store) => store.kbChangeCounter);
	const searchRef = useRef<HTMLInputElement>(null);
	const searchActive = query.trim().length >= 2;

	const open = useCallback((note: string) => {
		setUnresolved(null);
		setParams((previous) => { const next = new URLSearchParams(previous); next.set("note", note); next.delete("unresolved"); return next; });
	}, [setParams]);
	const search = useCallback((value: string) => {
		setParams((previous) => { const next = new URLSearchParams(previous); if (value) next.set("q", value); else next.delete("q"); return next; }, { replace: true });
	}, [setParams]);
	function ask(note = path): void { navigate(`/threads?draft=${encodeURIComponent(note ? `Change the note knowledge/${note}: ` : "Add a note to the knowledge base about ")}`); }
	function askMissing(): void { navigate(`/threads?draft=${encodeURIComponent(`Write the note knowledge/${unresolved}: `)}`); }

	useEffect(() => { try { localStorage.setItem(MAP_KEY, String(mapOpen)); } catch { /* The toggle still works when storage is disabled. */ } }, [mapOpen]);
	useEffect(() => {
		function key(event: KeyboardEvent): void {
			if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
			const target = event.target as HTMLElement | null;
			const typing = target?.matches("input, textarea, select, [contenteditable='true']");
			if (event.key === "Escape") { search(""); setUnresolved(null); return; }
			if (typing) return;
			if (event.key.toLowerCase() === "m") { event.preventDefault(); setMapOpen((value) => !value); }
			if (event.key === "/") { event.preventDefault(); searchRef.current?.focus(); }
		}
		window.addEventListener("keydown", key);
		return () => window.removeEventListener("keydown", key);
	}, [search]);
	useEffect(() => {
		let cancelled = false;
		void Promise.all([knowledge.tree(), knowledge.status(), knowledge.graph()]).then(([nextTree, nextStatus, nextGraph]) => {
			if (cancelled) return;
			setTree(nextTree); setStatus(nextStatus); setGraph(nextGraph); setError(null);
		}).catch((cause: unknown) => { if (!cancelled) setError(`Could not load the knowledge base. Check the deck connection, then retry. ${String(cause)}`); });
		return () => { cancelled = true; };
	}, [counter, retry]);
	useEffect(() => {
		setFile(null); setFileError(null); setBacklinks([]); setHistory([]); setHistoryError(null); setRelatedError(null); setUnresolved(null);
		if (!path) return;
		let cancelled = false;
		void knowledge.file(path).then((next) => { if (!cancelled) { setFile(next); setTitles((previous) => ({ ...previous, [next.path]: fileTitle(next) })); } }).catch((cause: unknown) => { if (!cancelled) setFileError(`Could not open this note. Pick another note or retry. ${String(cause)}`); });
		void knowledge.backlinks(path).then((next) => { if (!cancelled) setBacklinks(next.backlinks); }).catch((cause: unknown) => { if (!cancelled) setRelatedError(String(cause)); });
		void knowledge.history(path).then((next) => { if (!cancelled) setHistory(next); }).catch((cause: unknown) => { if (!cancelled) setHistoryError(String(cause)); });
		return () => { cancelled = true; };
	}, [path, counter, retry]);
	useEffect(() => {
		setResults(null); setSearchError(null); setSearching(searchActive);
		if (!searchActive) return;
		let cancelled = false;
		const timer = setTimeout(() => { void knowledge.search(query.trim()).then((next) => { if (!cancelled) setResults(next); }).catch((cause: unknown) => { if (!cancelled) setSearchError(`Search failed. Try again. ${String(cause)}`); }).finally(() => { if (!cancelled) setSearching(false); }); }, 160);
		return () => { cancelled = true; clearTimeout(timer); };
	}, [query, searchActive, counter]);
	const quickStart = useMemo(() => [...(graph?.nodes ?? [])].sort((a, b) => b.inbound - a.inbound || a.title.localeCompare(b.title)).slice(0, 6), [graph]);

	return <div className="neo-fill neo-knowledge">
		<PageHeader title={nav.label} description={nav.blurb} badge={<PreviewChip domains={["knowledge", "knowledgeHistory"]} />} actions={<><NeoButton variant="ghost" on={mapOpen} aria-pressed={mapOpen} onClick={() => setMapOpen((value) => !value)}><Network size={14} /> Map <Kbd>M</Kbd></NeoButton><NeoButton variant="primary" onClick={() => ask()}>Ask an agent</NeoButton></>} />
		{error ? <ErrorState error={error} onRetry={() => setRetry((value) => value + 1)} /> : null}
		<div className="neo-split neo-fill-body" data-side={mapOpen}>
			<aside className="neo-split-list" aria-label="Notes">
				<div className="neo-split-list-head"><SearchInput ref={searchRef} value={query} onChange={search} placeholder="Search notes" aria-label="Search notes" /><Segmented label="Browse notes" value={mode} onChange={setMode} options={[{ value: "tree", label: "Tree" }, { value: "recent", label: "Recent" }]} /></div>
				<div className="neo-split-rows">{tree ? <NoteList tree={tree} counter={counter} mode={mode} active={path} titles={titles} onOpen={open} results={results} searching={searching} searchError={searchError} searchActive={searchActive} /> : !error ? <TableSkeleton /> : null}</div>
				{status ? <footer className="neo-knowledge-list-footer">{status.fileCount} notes <span>Agent-maintained</span></footer> : null}
			</aside>
			<section className="neo-split-detail" aria-label="Note reader">
				{path ? fileError ? <ErrorState error={fileError} onRetry={() => setRetry((value) => value + 1)} /> : file ? <NoteReader key={file.path} file={file} onOpen={open} onAsk={() => ask()} onUnresolved={setUnresolved} /> : <TableSkeleton rows={8} /> : status ? <div className="neo-knowledge-welcome"><Card title="The shared knowledge base" description={`${status.fileCount} notes, connected by what the office has learned.`}><p className="neo-knowledge-root neo-mono">{status.root}</p><p className="neo-knowledge-quiet">{status.fileCount ? "Pick a note, follow its links, or explore the map. Ask an agent when something needs to change." : "Ask an agent to write the first note. Notes and their connections will appear here."}</p><NeoButton size="sm" onClick={() => { setMapOpen(true); setHops("0"); }}><Network size={13} /> Open the map</NeoButton></Card>{quickStart.length ? <section className="neo-knowledge-quick-start"><SectionLabel>Most linked notes</SectionLabel>{quickStart.map((note) => <button type="button" className="neo-knowledge-link-row" key={note.path} onClick={() => open(note.path)}><span><i className="neo-knowledge-dot" style={{ background: dirColor(note.dir) }} />{note.title}</span><small className="neo-mono">{note.path}</small></button>)}</section> : <Empty icon={BookOpen} title="No notes yet" hint="Ask an agent to capture something the office should know." action={<NeoButton onClick={() => ask()}>Ask an agent</NeoButton>} />}</div> : !error ? <TableSkeleton /> : null}
				{unresolved ? <div className="neo-knowledge-unresolved" role="status"><div><strong>{unresolved}</strong><p>No note with this name yet.</p></div><NeoButton size="sm" onClick={askMissing}>Ask an agent to write it</NeoButton><NeoButton size="sm" variant="ghost" icon aria-label="Dismiss missing note" onClick={() => setUnresolved(null)}><X size={13} /></NeoButton></div> : null}
			</section>
			{mapOpen ? <NoteMap graph={graph} file={file} backlinks={backlinks} history={history} historyError={historyError} relatedError={relatedError} hops={hops} onHops={setHops} onOpen={open} onUnresolved={setUnresolved} /> : null}
		</div>
	</div>;
}
