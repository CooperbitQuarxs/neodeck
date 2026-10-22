# Backend contracts the new deck designs against

Every domain in `apps/web/src/neo/client/` has a typed client with a `live`
adapter (existing deck endpoints) and a `preview` adapter (in-memory
fixtures that mutate, so the page is fully interactive). The registry in
`client/source.ts` says which is in use per domain, with the reason. This
file is the contract a backend implements to flip a domain to `live`; the
TypeScript shapes in the client files are authoritative, and the fixtures
are the examples.

Vocabulary shared with NeoProxy (`NeoProxy/docs/design/backend-contracts.md`):
a **virtual model** is `neoproxy/<name>` (`default`, `small`, `heavy`, `live`
are virtual models, not a separate "role" object); its **chain** is a list
of **stages** `{ model, accounts, draw, perAccount, cap, window, per, effort }`
joined by "demote", ending in a **terminal** `{ kind: limit | queue |
passthrough, message }`; an account's grant carries an `allotment` (0..1)
that scales every budget. NeoDeck's "hidden from pickers" is local to the
deck (still served); NeoProxy's `exposed: false` removes a provider.

## 1. Auth and accounts (`auth`, `accounts`)

- `POST /api/auth/login` `{ handle, password }` → `200 { account: Account, token }`, `401` on mismatch. Cookie or bearer; the client sends nothing extra.
- `GET /api/auth/me` → `{ account }` or `401`. `POST /api/auth/logout` → `204`.
- `GET /api/accounts` (admin) → `{ accounts: Account[] }`; `POST /api/accounts` `{ handle, name, password, role, models }`; `PATCH /api/accounts/:id` `{ name?, role?, models?, allotment?, password? }`.
- `Account { id, handle, name, role: "admin"|"member", hue, roles: string[], allotment?: number }`; `roles` are the virtual models (`neoproxy/<name>`) the admin granted the account.

## 2. Classifier and inbox history (`classifier`)

- `GET /api/inbox/:id/proposal` → `Proposal { itemId, kind, destination, confidence, reason }`.
- `POST /api/inbox/:id/file` `{ destination }` → `{ receipt: { kind, ref, url } }`, and appends to the item's history. `destination` is one of `card{project,column}`, `issue{repo}`, `thread{agent}`, `note{path}`.
- `GET /api/inbox/:id/history` → `{ events: { at, actor, text }[] }`.

## 3. Presence (`presence`)

- `GET /api/presence` → `{ needsYou, working, inReview }`; also pushed on the websocket as `presence` frames.

## 4. Threads with several agents (`threadAgents`)

A thread is a session that hosts agents as equals. Today a session has exactly one (the deck's `Main`); the contract adds the rest.

- `GET /api/threads/:id/agents` → `{ agents: ThreadAgent[] }`; `ThreadAgent { id, name, hue, model, template, state: "needs-you"|"working"|"idle", restrictions: Restriction[], spawnedBy? }`.
- `POST /api/threads/:id/agents` `{ name, hue, model, template, restrictions }` → `ThreadAgent`; `DELETE /api/threads/:id/agents/:agentId`.
- `POST /api/threads/:id/send` `{ text, to: agentId | "all", images? }`: the composer's target. Assistant messages on the websocket carry `agentId` so the transcript can colour them.
- `PATCH /api/threads/:id/agents/:agentId` `{ model?, restrictions? }`: loosening or tightening at runtime (the owner's model: hierarchy is a restriction, not a type).

## 5. Agents, templates and the judge (`agents`, `judge`)

- `GET /api/agents` → `{ agents: LiveAgent[] }` across threads, cards and routines. `LiveAgent { id, name, template, model, where: { kind: "thread"|"card"|"routine", id, label }, state, owner, tokens, costUsd, since, hue }`.
- `GET /api/agents/templates` → `{ templates: AgentTemplate[] }`; `POST`/`PUT /api/agents/templates/:id`; `DELETE`. `AgentTemplate { id, name, blurb, model, restrictions: Restriction[] }`; `Restriction { key: "visibility"|"lifecycle"|"spawn"|"model"|"prompt"|"tools", label }`.
- `POST /api/agents` `{ template, name, hue, model, restrictions, where }` spawns one; `POST /api/agents/:id/stop`; `PATCH /api/agents/:id` `{ model?, restrictions? }`.
- `GET /api/judge/events?limit=` → `{ events: JudgeEvent[] }`; websocket frame `judge_event`. `POST /api/judge/events/:id/undo` re-spawns what a "stopped" event stopped. `GET/PUT /api/judge` `{ model, intervalSec, paused }`.

## 6. Board evidence (`boardEvidence`)

Cards and columns are live (`/api/tasks`, `/api/task-states`). The contract adds what a card knows about itself:

- `GET /api/tasks/:id/events` → `{ events: BoardEvent[] }`; `BoardEvent { id, at, actor, text, tone? }` (captured, assigned, run started/finished, PR opened, review, merged).
- `GET /api/tasks/:id/links` → `{ issue?: { repo, number, url }, pr?: { repo, number, url }, thread?: { id }, flow?: { id, name } }`.
- Card properties the deck reads from the card's front matter: `origin: inbox|github|thread|routine|manual`, `origin_ref`, `holder: { kind: "person", handle } | { kind: "agent", id }`.
- `POST /api/tasks/:id/assign` accepts `{ model? }` (today it takes no body).

## 7. Studio graphs (`studioGraphs`)

Flows are today's routines (`/api/routines`). The other kinds share one document:

- `GET /api/graphs` → `{ graphs: GraphSummary[] }` for kinds `pipeline | router | classifier | boardflow` (+ `flow` mirrored from routines, `map` virtual).
- `GET/PUT/DELETE /api/graphs/:id` → `StudioGraph { id, kind, name, description, enabled, nodes: { id, type, config, position }[], edges: { id, from: { node, port }, to: { node, port } }[], settings, lastRun?, updatedAt }`; `POST /api/graphs` `{ kind, name }`.
- `GET /api/graphs/node-types?kind=` → the node vocabulary (`apps/web/src/neo/pages/studio/vocab.ts` is the reference data: types, ports with types, fields with controls).
- `POST /api/graphs/:id/run` → `StudioRun`; `GET /api/graphs/:id/runs` → `{ runs: StudioRun[] }`; `StudioRun { id, graphId, startedAt, endedAt?, ok, trigger, costUsd?, nodes: { nodeId, startedAt, endedAt?, status, note? }[] }`.
- A router graph is the visual form of a NeoProxy virtual model's chain; saving one writes the virtual model (`PUT /neoproxy/api/virtual-models/:name`).
- Pipeline, router, classifier and board-flow previews save documents in the browser's local storage; preview runs stay in memory and never send inference requests or output actions.
- Source is TOML (`text/toml`) on `GET /api/graphs/:id?format=toml` and `PUT` with the same type; flows stay YAML until routines migrate.

## 8. Dictation (`dictation`)

- `POST /api/dictation/transcribe` body `audio/webm` (or whatever MediaRecorder produced) → `{ text }`. Routed through xAI STT with a local parakeet fallback; `404` until wired, which the composer reports as "Dictation isn't wired on this deck yet."
- `GET/PUT /api/settings/dictation` `{ engine: "xai"|"parakeet"|"off", language, holdKey }`.

## 9. Knowledge history (`knowledgeHistory`)

Notes are read live (`/api/kb/*`); humans do not write (the server refuses by design; agents write through `kb_write`). The page's verb is "Ask an agent", which opens a thread.

- `GET /api/kb/history?path=` → `{ events: { id, at, actor, kind: "wrote"|"asked"|"linked", text, threadId? }[] }`.

## 10. Skills usage

- `GET /api/skills/usage` → `{ [skillId]: { lastUsedAt, uses7d } }`.

## 11. GitHub (`github`)

The GitHub page is live and read-only through the server's authenticated
`gh api graphql`. Queries name the configured repository explicitly, never a
fork's upstream. No GitHub mutations are exposed by this adapter.

- `GET /api/github/repos` → `{ repos: string[] }`, tracked `owner/repo` addresses.
- `PUT /api/github/repos` `{ repos: string[] }` saves only the local watchlist in `$NPI_DECK_HOME/github-repos.json`, up to 20 repositories. An empty list tracks nothing. Before the first save, `NPI_DECK_GITHUB_REPOS` supplies comma/space-separated addresses, or the server discovers GitHub `origin` remotes from configured workspaces.
- `GET /api/github/snapshot` → `{ repos, issues, pulls, wheel, viewer, configuredRepos, errors, fetchedAt, limit: 100 }`. One query per repository retrieves the 100 most recently updated issues and PRs, repository-wide open counts, PR checks/review decisions and the last 20 conversation comments. `viewer` is the server CLI's GitHub login and supports the PR author filter, not Deck account identity. Inline reviews and full history stay on GitHub. Results are cached for 30 seconds with single-flight refreshes. Four workers share a 45-second deadline; each CLI call also has a 30-second limit. Timed-out or failed repositories report errors without hiding successful repositories. The HTTP request has a finite 60-second ceiling.
- Ready follows `ready`, `agent: pending` or `state: ready`; Implementing follows `implementing`, `agent: started`, `human: started` or `state: implementing`. Open PRs enter PR open, then Review when GitHub reports a review decision or review label. Merged is GitHub's merged state. Nightly requires an explicit `nightly`, `state: nightly` or `status: nightly` label, never an inferred deployment. Wheel timestamps are last updates, not claimed transition history.

The GitHub App installation in Settings remains preview. App-backed writes,
issue filing, wheel advancement, agent assignment and full event timelines
are not implemented by the CLI adapter.

## 12. Usage and providers (`usage`, `providers`)

- `GET /api/usage/me?period=today|week|month` → `{ pools: Pool[], spend: SpendPoint[], requests: UsageRequest[], resetsAt }`; `GET /api/usage/accounts/:id?period=` (admin). `Pool { role /* virtual model name */, chain: Stage[], terminal, spentUsd, requests, resetsAt }`, `UsageRequest { at, model /* virtual */, resolved, where, tokens, costUsd }`.
- `GET /api/providers` → `{ providers: ProviderExposure[] }`; `PATCH /api/providers/:id` `{ hidden }` (admin; hidden from pickers, still served).

## 13. Settings

Env (`/api/settings/env`), NeoPi config (`/api/npi-config`), models (`/api/models-config`), MCP (`/api/mcp-servers`), bridges (`/api/bridges`), workspaces and notifications are live. The contract adds accounts (§1), dictation (§8), the GitHub app (§11), and a deck-config read: `GET /api/state` already serves it.
