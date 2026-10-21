import { useState } from "react";
import { Dot, Empty, formatShortRelative, NeoBadge, NeoSelect, SearchInput, Segmented, Table, Toolbar } from "@/components/neo";
import { GITHUB_LABELS, type GitHubIssue, type GitHubPull } from "../../client/github";
import { AgentSwatch } from "../../components/AgentSwatch";
import { Avatar } from "../../components/Avatar";

export function IssuesTable({ issues, onSelect }: { issues: GitHubIssue[]; onSelect: (issue: GitHubIssue) => void }) {
	const [q, setQ] = useState(""); const [state, setState] = useState<"open" | "closed">("open"); const [label, setLabel] = useState("all");
	const visible = issues.filter((i) => i.state === state && (label === "all" || i.labels.includes(label)) && `${i.number} ${i.title}`.toLowerCase().includes(q.toLowerCase()));
	return <><Toolbar><SearchInput value={q} onChange={setQ} placeholder="Search issues by title or number" /><Segmented label="Issue state" value={state} onChange={setState} options={[{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }]} /><NeoSelect aria-label="Label" value={label} onChange={(e) => setLabel(e.target.value)}><option value="all">All labels</option>{GITHUB_LABELS.map((l) => <option key={l}>{l}</option>)}</NeoSelect></Toolbar><Table rows={visible} rowKey={(i) => i.number} onRowClick={onSelect} empty={<Empty title="No issues match" hint="Clear the search, choose another label, or switch the issue state." />} columns={[
		{ key: "number", header: "#", width: 64, sort: (i) => i.number, render: (i) => <span className="neo-mono neo-dim">#{i.number}</span> },
		{ key: "title", header: "Title", sort: (i) => i.title, render: (i) => <div className="neo-github-issue-title"><span>{i.title}</span><div className="neo-github-labels">{i.labels.map((l) => <NeoBadge key={l}>{l}</NeoBadge>)}</div></div> },
		{ key: "author", header: "Author", render: (i) => <span className="neo-github-person"><Avatar account={i.author} />{i.author.name}</span> },
		{ key: "agent", header: "Agent", render: (i) => i.agent ? <AgentSwatch hue={i.agent.hue} name={i.agent.name} /> : <span className="neo-dim">Unclaimed</span> },
		{ key: "updated", header: "Updated", sort: (i) => i.updatedAt, render: (i) => <span className="neo-mono neo-dim">{formatShortRelative(i.updatedAt)}</span> },
	]} /></>;
}
export function PullsTable({ pulls, onSelect }: { pulls: GitHubPull[]; onSelect: (pull: GitHubPull) => void }) {
	return <Table rows={pulls.filter((p) => p.state === "open")} rowKey={(p) => p.number} onRowClick={onSelect} empty={<Empty title="No open pull requests" hint="Pull requests appear here when a worker opens one." />} columns={[
		{ key: "number", header: "#", render: (p) => <span className="neo-mono neo-dim">#{p.number}</span> },
		{ key: "title", header: "Title", render: (p) => p.title },
		{ key: "branch", header: "Branch", render: (p) => <span className="neo-mono neo-dim">{p.branch} → {p.base}</span> },
		{ key: "checks", header: "Checks", render: (p) => <div className="neo-github-check-dots">{p.checks.map((c) => <span key={c.name} title={`${c.name}: ${c.state}`} aria-label={`${c.name}: ${c.state}`}><Dot tone={c.state === "success" ? "ok" : c.state === "failure" ? "bad" : "warn"} /></span>)}</div> },
		{ key: "review", header: "Review", render: (p) => <NeoBadge tone={p.review === "changes requested" ? "accent" : p.review === "approved" ? "ok" : "warn"}>{p.review}</NeoBadge> },
		{ key: "agent", header: "Agent", render: (p) => p.agent ? <AgentSwatch hue={p.agent.hue} name={p.agent.name} /> : <span className="neo-dim">–</span> },
		{ key: "updated", header: "Updated", render: (p) => <span className="neo-mono neo-dim">{formatShortRelative(p.updatedAt)}</span> },
	]} />;
}
