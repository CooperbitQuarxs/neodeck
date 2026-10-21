# Backend contracts the new deck designs against

Every domain in `apps/web/src/neo/client/` has a typed client with a `live`
adapter (existing deck endpoints) and a `preview` adapter (fixtures in
`preview-data.ts`). The registry in `client/source.ts` says which is in use.
This file is the contract a backend implements to flip a domain to `live`;
the TypeScript shapes in `preview-data.ts` are authoritative.

## 1. Auth and accounts (`auth`, `accounts`)

- `POST /api/auth/login` `{ handle, password }` → `200 { account: Account, token }`, `401` on mismatch. Cookie or bearer; the client sends nothing extra.
- `GET /api/auth/me` → `{ account }` or `401`.
- `POST /api/auth/logout` → `204`.
- `GET /api/accounts` (admin) → `{ accounts: Account[] }`; `PATCH /api/accounts/:id` `{ role?, roles? }`.
- `Account { id, handle, name, role: "admin"|"member", hue, roles: string[] }`; `roles` are the `neoproxy/<name>` roles the admin mapped for the account.

## 2. Classifier (`classifier`)

- `GET /api/inbox/:id/proposal` → `Proposal { itemId, kind, destination, confidence, reason }`.
- `POST /api/inbox/:id/file` `{ destination }` → `{ receipt: { kind, ref, url } }`, and appends to the item's history. `destination` is one of `card{project,column}`, `issue{repo}`, `thread{agent}`, `note{path}`.
- `GET /api/inbox/:id/history` → `{ events: { at, actor, text }[] }`.

## 3. Presence (`presence`)

- `GET /api/presence` → `{ needsYou, working, inReview }`; also pushed on the websocket as `presence` frames.

## 4. Agents and the judge (`agents`, `judge`)

- `GET /api/agents` → `{ agents: LiveAgent[] }` across threads, cards and routines.
- `GET /api/agents/templates` → `{ templates: AgentTemplate[] }`; `POST /api/agents` `{ template, where, model?, restrictions? }` spawns one; `POST /api/agents/:id/stop`.
- `GET /api/judge/events?limit=` → `{ events: JudgeEvent[] }`; websocket frame `judge_event`.

## 5. GitHub (`github`)

- `GET /api/github/repos` → `{ repos: Repo[] }`.
- `GET /api/github/wheel?repo=` → `{ items: WheelItem[] }` (stages ready → implementing → pr → review → merged → nightly).
- `POST /api/github/issues` `{ repo, title, body, cardId? }` → `{ number, url }`.

## 6. Usage and providers (`usage`, `providers`)

- `GET /api/usage/me` → `{ pools: Pool[], spend: SpendPoint[] }`; `GET /api/usage/accounts/:id` (admin).
- `GET /api/providers` → `{ providers: ProviderExposure[] }`; `PATCH /api/providers/:id` `{ hidden }` (admin).

## 7. Studio (`studio`)

- `GET /api/graphs` → `GraphSummary[]`; `POST /api/graphs` `{ kind, name }` → `StudioGraph`.
- `GET /api/graphs/:id` → `StudioGraph`; `PUT /api/graphs/:id` accepts that document and returns the saved document; `DELETE /api/graphs/:id` removes it.
- `POST /api/graphs/:id/run` → `StudioRun`; `GET /api/graphs/:id/runs` → `StudioRun[]`, with per-node timing and output notes.
- `GET /api/graphs/node-types?kind=` → `NodeType[]`. The plain-data registry is `neo/pages/studio/vocab.ts`; the graph and run interfaces are exported by `neo/client/studio.ts`.
- Graph documents contain `id`, `kind`, `name`, `description`, `enabled`, `nodes`, `edges`, `settings`, `updatedAt` and optional `lastRun`. Each node has an id, vocabulary type, configuration and x/y position. An edge names its source and target node and port. Ports must have matching types, unless either is `any`.
- Flows stay on `/api/routines`; the existing routine builder owns their YAML source. The map stays on `/api/kb/graph` and is read-only in Studio. Neither is rewritten into a preview graph.
- Routers edit virtual models such as `neoproxy/heavy`. An entry leads to model stages, and stage-to-stage edges mean demotion. A stage defines model, accounts, draw strategy, per-account pool percentage, cap, whether the cap applies per user or to all users, window and optional effort. A terminal limits, queues or passes through.
- Pipeline, router, classifier and board-flow previews save documents in this browser's local storage. Their run records remain in memory and never send inference requests or output actions.
