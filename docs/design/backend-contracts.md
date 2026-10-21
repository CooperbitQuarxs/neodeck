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

- `GET /api/graphs` → `{ graphs: GraphSummary[] }` for kinds `flow | pipeline | router | classifier | boardflow`. Flows are today's routines (`/api/routines`); the other kinds share the graph document shape in `@npi-deck/protocol` (`RoutineGraph`) with a per-kind node registry at `GET /api/graphs/node-types?kind=`.
- `GET /api/graphs/:id/runs` → runs with step runs, same shape as routine runs.
