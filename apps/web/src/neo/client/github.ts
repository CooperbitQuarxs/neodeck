import { tasksApi } from "@/lib/tasks-api";
import { PREVIEW_REPOS, PREVIEW_WHEEL, type Repo, type WheelItem, type WheelStage } from "./preview-data";
import { SOURCES } from "./source";
export type { Repo, WheelStage };

/** Person or agent credited on a GitHub issue or review. */
export interface GitHubAuthor { name: string; hue: number }
/** GET /api/github/issues: repository issue, including its linked board card. */
export interface GitHubIssue { repo: string; number: number; title: string; body: string; state: "open" | "closed"; labels: string[]; author: GitHubAuthor; agent?: GitHubAuthor; updatedAt: string; card?: string }
/** Check-run result on a pull request. */
export interface GitHubCheck { name: string; state: "success" | "pending" | "failure" }
/** Review comment, as markdown with an optional file anchor. */
export interface GitHubComment { id: string; author: GitHubAuthor; body: string; at: string; path?: string }
/** GET /api/github/pulls: checks, review state and branch destination. */
export interface GitHubPull extends GitHubIssue { branch: string; base: string; checks: GitHubCheck[]; review: "waiting" | "changes requested" | "approved"; comments: GitHubComment[] }
/** Timestamped transition in the implementation wheel. */
export interface WheelEvent { stage: WheelStage; at: string; agent?: string; detail: string }
/** GET /api/github/wheel: wheel item plus timeline and its working thread. */
export interface GitHubWheelItem extends WheelItem { timeline: WheelEvent[]; thread?: string; model?: string }
/** Repository snapshot; each array is scoped by its repo id. */
export interface GitHubSnapshot { repos: Repo[]; issues: GitHubIssue[]; pulls: GitHubPull[]; wheel: GitHubWheelItem[] }
/** POST /api/github/issues: issue fields and an explicit live board opt-in. */
export interface FileIssueInput { repo: string; title: string; body: string; labels: string[]; board: boolean }
/** Typed operations shared by the preview wheel and the future GitHub app. */
export interface GitHubClient { snapshot(): Promise<GitHubSnapshot>; fileIssue(input: FileIssueInput): Promise<GitHubIssue>; sendToWheel(repo: string, number: number): Promise<void>; transition(id: string, stage: WheelStage, model?: string): Promise<void> }
export const GITHUB_LABELS = ["bug", "enhancement", "documentation", "ready", "agent: started"] as const;
export const WHEEL_STAGES: readonly { id: WheelStage; label: string }[] = [{ id: "ready", label: "Ready" }, { id: "implementing", label: "Implementing" }, { id: "pr", label: "PR open" }, { id: "review", label: "Review" }, { id: "merged", label: "Merged" }, { id: "nightly", label: "Nightly" }];
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const people: GitHubAuthor[] = [{ name: "Lin", hue: 190 }, { name: "Ada", hue: 40 }, { name: "Shay", hue: 300 }];
const worker: GitHubAuthor = { name: "Worker", hue: 40 };
const atlasTitles = ["Add lastmod to the sitemap", "Benchmark the render cache on the 400-page site", "Fix anchor links after heading rename", "Dark theme toggle", "Index translated pages with Pagefind", "Stabilize the flaky sidebar test", "Preserve query strings in redirects", "Add copy buttons to code blocks", "Document custom syntax themes", "Avoid duplicate anchors in nested headings", "Show a useful 404 page", "Update the getting-started screenshots", "Cache navigation between pages", "Respect reduced motion in search"];
const atlasNumbers = [231, 229, 226, 224, 223, 222, 221, 220, 219, 218, 217, 216, 215, 214];
function issue(repo: string, number: number, title: string, index: number): GitHubIssue { return { repo, number, title, body: `## What should change\n\n${title}.\n\n## Acceptance\n\n- Works on the docs site and in the local preview.\n- Includes a focused regression check.`, state: "open", labels: [index % 3 === 0 ? "enhancement" : index % 3 === 1 ? "documentation" : "bug", ...(number === 231 || number === 229 ? ["ready"] : [])], author: people[index % people.length]!, ...(number === 226 || number === 224 ? { agent: worker, card: number === 226 ? "T-5" : "T-6" } : {}), updatedAt: ago(15 + index * 41) }; }
const issues: GitHubIssue[] = [
	...atlasTitles.map((title, i) => issue("atlas", atlasNumbers[i]!, title, i)),
	...["Resume interrupted file uploads", "Show upload progress", "Add file expiry controls", "Improve keyboard navigation", "Document storage limits", "Fix thumbnail orientation"].map((title, i) => issue("portal", 49 - i, title, i)),
	...Array.from({ length: 22 }, (_, i) => issue("qpanel", 122 - i, ["Retry failed nightly builds", "Keep the selected dashboard range", "Fix chart axis labels", "Document workspace configuration", "Preserve filters on refresh", "Improve the empty query state", "Export query results as CSV", "Add keyboard shortcuts to tables", "Keep long query names readable", "Show connection health", "Refresh expired database tokens"][i % 11]!, i)),
];
const pulls: GitHubPull[] = [
	{ ...issue("atlas", 212, "Cache the first render pass", 0), branch: "feat/render-cache", base: "nightly", checks: [{ name: "Typecheck", state: "success" }, { name: "Render tests", state: "failure" }, { name: "Link check", state: "success" }], review: "changes requested", agent: worker, card: "T-10", comments: [{ id: "c1", author: people[0]!, body: "The cache key needs the locale. Otherwise the French page gets the English title.", path: "src/render/cache.ts:48", at: ago(72) }, { id: "c2", author: people[1]!, body: "Please add a regression for a heading rename before merging. The stale anchor is still in the cached navigation.", path: "tests/render.test.ts:91", at: ago(65) }] },
	{ ...issue("atlas", 230, "Add Pagefind search to the docs", 1), branch: "feat/pagefind", base: "nightly", checks: [{ name: "Typecheck", state: "success" }, { name: "Search tests", state: "success" }], review: "approved", agent: worker, comments: [] },
	{ ...issue("atlas", 228, "Keep the table of contents in view", 2), branch: "fix/sticky-toc", base: "nightly", checks: [{ name: "Typecheck", state: "success" }, { name: "Visual checks", state: "pending" }], review: "waiting", comments: [] },
	{ ...issue("portal", 44, "File depot: resumable uploads", 0), branch: "feat/resumable-uploads", base: "main", checks: [{ name: "Upload tests", state: "success" }], review: "waiting", agent: worker, comments: [] },
];
const wheel: GitHubWheelItem[] = PREVIEW_WHEEL.map((item): GitHubWheelItem => ({ ...item, thread: item.stage === "implementing" ? item.number === 226 ? "preview:anchors" : "preview:theme" : undefined, timeline: [{ stage: "ready", at: ago(600), detail: "Marked ready for implementation" }, ...(item.stage === "ready" ? [] : [{ stage: item.stage, at: item.since, agent: item.agent, detail: item.stage === "implementing" ? "Started from the linked board card" : `Moved to ${WHEEL_STAGES.find((s) => s.id === item.stage)!.label.toLowerCase()}` }])] }));
const state: GitHubSnapshot = { repos: structuredClone([...PREVIEW_REPOS]), issues, pulls, wheel };
const preview: GitHubClient = {
	async snapshot() { return structuredClone(state); },
	async fileIssue(input) {
		const repo = state.repos.find((r) => r.id === input.repo); if (!repo) throw new Error("Choose a repository before filing the issue.");
		const number = Math.max(0, ...state.issues.filter((i) => i.repo === input.repo).map((i) => i.number), ...state.pulls.filter((i) => i.repo === input.repo).map((i) => i.number)) + 1;
		let card: string | undefined;
		if (input.board) { const task = await tasksApi.create({ title: input.title, body: input.body, properties: { origin: "github", githubRepo: repo.name, githubIssue: number, githubUrl: `https://github.com/${repo.name}/issues/${number}` } }); card = `T-${task.displayId}`; }
		const created: GitHubIssue = { repo: input.repo, number, title: input.title, body: input.body, labels: [...input.labels], state: "open", author: people[2]!, updatedAt: ago(0), card };
		state.issues.unshift(created); repo.openIssues++; return structuredClone(created);
	},
	async sendToWheel(repo, number) { if (state.wheel.some((w) => w.repo === repo && w.number === number)) return; const item = state.issues.find((i) => i.repo === repo && i.number === number); if (!item) throw new Error("This issue no longer exists."); state.wheel.push({ id: crypto.randomUUID(), repo, number, title: item.title, stage: "ready", card: item.card, since: ago(0), timeline: [{ stage: "ready", at: ago(0), detail: "Sent to the wheel" }] }); if (!item.labels.includes("ready")) item.labels.push("ready"); },
	async transition(id, stage, model) { const item = state.wheel.find((i) => i.id === id); if (!item) throw new Error("This wheel item no longer exists."); item.stage = stage; item.since = ago(0); item.model = model ?? item.model; if (stage === "implementing") { item.agent = "Worker"; item.thread = item.number === 231 ? "sitemap" : "build"; const issue = state.issues.find((i) => i.repo === item.repo && i.number === item.number); if (issue) { issue.agent = worker; issue.updatedAt = ago(0); if (!issue.labels.includes("agent: started")) issue.labels.push("agent: started"); } } item.timeline.push({ stage, at: item.since, agent: item.agent, detail: stage === "implementing" ? `Assigned with ${model ?? "neoproxy/heavy"}` : `Moved to ${WHEEL_STAGES.find((s) => s.id === stage)!.label.toLowerCase()}` }); const pull = state.pulls.find((p) => p.repo === item.repo && p.number === item.number); if (pull && stage === "review") pull.review = "waiting"; if (pull && stage === "merged") { pull.state = "closed"; const repo = state.repos.find((r) => r.id === item.repo)!; repo.openPrs = Math.max(0, repo.openPrs - 1); } },
};
async function request<T>(path: string, body?: unknown): Promise<T> { const response = await fetch(`/api/github${path}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined); if (!response.ok) throw new Error(`GitHub request failed (${response.status}). Try again.`); return response.status === 204 ? undefined as T : response.json() as Promise<T>; }
const live: GitHubClient = { snapshot: () => request<GitHubSnapshot>("/snapshot"), fileIssue: (input) => request<GitHubIssue>("/issues", input), sendToWheel: (repo, number) => request<void>("/wheel", { repo, number }), transition: (id, stage, model) => request<void>(`/wheel/${encodeURIComponent(id)}`, { stage, model }) };
export const github: GitHubClient = SOURCES.github === "live" ? live : preview;
