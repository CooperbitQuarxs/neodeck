import type { KbBacklink, KbFileResponse, KbGraphResponse } from "@npi-deck/protocol";
import { Empty, SectionLabel, Segmented, formatShortRelative } from "@/components/neo";
import type { KnowledgeHistoryEntry } from "../../client/knowledge";
import { AgentSwatch } from "../../components/AgentSwatch";
import { KnowledgeMap } from "../../components/KnowledgeMap";
import { PreviewChip } from "../../components/PreviewChip";
import { noteTitle } from "./NoteList";

export function NoteMap({ graph, file, backlinks, history, historyError, relatedError, hops, onHops, onOpen, onUnresolved }: {
	graph: KbGraphResponse | null; file: KbFileResponse | null; backlinks: KbBacklink[]; history: KnowledgeHistoryEntry[]; historyError: string | null; relatedError: string | null;
	hops: "1" | "2" | "0"; onHops: (hops: "1" | "2" | "0") => void; onOpen: (path: string) => void; onUnresolved: (target: string) => void;
}) {
	return <aside className="neo-split-side neo-knowledge-side" aria-label="Note map and connections">
		<header className="neo-knowledge-map-head"><h2>Map</h2><Segmented label="Map scope" value={hops} onChange={onHops} options={[{ value: "1", label: "1 hop" }, { value: "2", label: "2 hops" }, { value: "0", label: "whole" }]} /></header>
		<div className="neo-knowledge-map-canvas">{graph?.nodes.length ? <KnowledgeMap graph={graph} focus={file?.path} hops={Number(hops)} onOpen={onOpen} /> : <Empty title={graph ? "No notes to map yet" : "Loading the map…"} hint={graph ? "Ask an agent to add a note with links." : undefined} />}</div>
		<div className="neo-knowledge-map-caption">{graph ? <>{graph.nodes.length} notes <span>·</span> {graph.edges.length} connections{graph.unresolvedCount ? <p>{graph.unresolvedCount} {graph.unresolvedCount === 1 ? "link points" : "links point"} nowhere yet</p> : null}{graph.truncated ? <p>Map limited to {graph.nodes.length} of {graph.totalNodes} notes.</p> : null}</> : "Building connections…"}</div>
		<div className="neo-knowledge-connections">
			{relatedError ? <p className="neo-knowledge-quiet" role="alert">Could not load connections. {relatedError}</p> : null}
			<SectionLabel>Backlinks {backlinks.length}</SectionLabel>
			{!file ? <p className="neo-knowledge-quiet">Open a note to see what links to it.</p> : !backlinks.length ? <p className="neo-knowledge-quiet">No other note links here yet.</p> : backlinks.map((link, index) => <button key={`${link.source}:${index}`} type="button" className="neo-knowledge-link-row" onClick={() => onOpen(link.source)} title={link.snippet}>
				<span>{graph?.nodes.find((node) => node.path === link.source)?.title ?? noteTitle(link.source)}</span><small className="neo-mono">{link.source}</small>
			</button>)}
			<SectionLabel>Links out {file?.outgoingLinks.length ?? 0}</SectionLabel>
			{!file?.outgoingLinks.length ? <p className="neo-knowledge-quiet">{file ? "This note has no outgoing links." : "Open a note to follow its links."}</p> : file.outgoingLinks.map((link, index) => <button key={`${link.raw}:${index}`} type="button" className="neo-knowledge-link-row" data-unresolved={!link.resolved} title={link.resolved ?? "No note with this name yet"} onClick={() => link.resolved ? onOpen(link.resolved) : onUnresolved(link.target)}><span>{link.label}</span><small className="neo-mono">{link.resolved ?? "Not written yet"}</small></button>)}
			<SectionLabel actions={<PreviewChip domains={["knowledgeHistory"]} what="Note history" />}>History</SectionLabel>
			{!file ? <p className="neo-knowledge-quiet">Open a note to see its history.</p> : historyError ? <p className="neo-knowledge-quiet" role="alert">Could not load history. {historyError}</p> : history.map((event) => <div key={event.id} className="neo-knowledge-history"><div><AgentSwatch hue={event.actor === "chronicler" ? 260 : 190} name={event.actor} /><time title={event.at}>{formatShortRelative(event.at)}</time></div><p>{event.kind} {event.text}</p></div>)}
		</div>
	</aside>;
}
