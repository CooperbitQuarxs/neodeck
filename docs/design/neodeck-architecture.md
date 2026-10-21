# NeoDeck: the new deck

The owner's order of 2026-10-21: design NeoDeck from scratch, with the old
OMP Deck as reference only and NeoPi's web language (`/stats`, `/collab`,
`/share`) as the one fixed thing. Required reading behind this document:
`neocore/docs/vision/2026-10-13-captain-vision.md`,
`neocore/docs/vision/2026-10-20-neo-vision-verbatim.md`, the fragments beside
them, and her OMP Deck vision diary. This file is the design: what the deck
is, how it is organised, and the decisions she can reject.

## 1. What the deck is

A cockpit for an office whose workers are people, agents and routines, on a
shared machine. One place everyone goes. The inbox is the front door; the
board is the work; threads are how you talk to agents; agents are equals and
every restriction on one is visible; graphs (what we know, what we do) are a
first-class workshop, not a corner of the scheduler; GitHub governs code and
is wired in, not bolted on; every account has quotas and can see its usage;
NeoPi is the engine and NeoProxy is how its providers reach the office.

The old deck was "a GUI for the harness": thirteen pages, three columns on
every page with two toggles to hide them, a sidebar that listed features
instead of work, a modal for a task, a planned page for every idea. The new
deck has nine places, each with one job, and detail opens beside the list
instead of on top of it.

## 2. Information architecture

Sidebar, grouped as `/stats` groups its pages. Hotkeys are `G` then the
letter.

```
Office      Inbox (i)      capture · triage · promote; the Today strip
            Board (b)      one board, every project, cards with evidence
            Threads (t)    talk to agents; several primaries in one thread
Agents      Agents (a)     everything alive: roster, templates, the judge log
            Studio (u)     graphs you build: flows, routers, classifiers, map
Library     Knowledge (k)  the wiki, with the map one keystroke away
            Skills (s)     installed skills and the marketplace, one page
Engine      GitHub (g)     repos, issues, PRs, the implementation wheel
            Usage (y)      your quota, your pools, what you spent
            Settings (,)   engine, accounts, integrations, appearance
```

There is no Home. The Inbox carries the "what needs me" strip at its top, so
signing in lands you where work starts. (Reject: restore a Home page.)

`/login` gates everything. `/legacy/*` keeps the old deck reachable until the
new one covers every feature it had (Settings › Legacy deck).

## 3. The shell

Unchanged chassis from the design language: 52 px glass topbar with the
`NeoPi / deck / Page` lockup, naked grouped sidebar (224 px), one inset
panel. Two changes:

- The topbar's right side is the **presence row**: the engine chip, the
  signed-in account (avatar + name, opens Usage), dictation, theme. Nothing
  else. View-local toggles are gone; a page that needs a side column has it
  inside the panel, always.
- The sidebar foot shows **who is live**: the number of agents working and
  the number of threads that need you, as two small dots, so the state of the
  office is visible from every page.

Pages are one of three shapes, never a fourth:

1. **List + drawer** (Board, Agents, GitHub, Skills, Usage): page header,
   stat strip, filter bar, dense sortable table or grid; a row opens a right
   drawer (560 px) with a pinned footer. Nothing floats.
2. **Master–detail** (Inbox, Threads, Knowledge): a 300 px list column with
   its own search at the top, the detail fills the rest. Both columns are
   fixed regions inside the panel.
3. **Canvas** (Studio): a 56 px toolbar, the canvas, a 320 px inspector.

## 4. Pages

### Inbox (the front door)

```
┌ Today ──────────────────────────────────────────────────────────────────┐
│ 3 need you · 2 agents working · 1 PR waiting for review · 4 unread      │
├──────────────┬──────────────────────────────────────────────────────────┤
│ search       │ Sitemap lastmod                        capture · 2h ago  │
│ Unread 4     │ ───────────────────────────────────────────────────────  │
│ ● Sitemap…   │ body (markdown)                                          │
│ ● Docs search│                                                          │
│ ○ Theme…     │ Proposed: ticket → Board › atlas › backlog   [Accept] [Edit]│
│ …            │ Promote to: card · issue · thread · note                 │
│ ─ Done ─     │ History: captured by lin · classified by judge           │
├──────────────┴──────────────────────────────────────────────────────────┤
│ Capture: [ title…                               ] [kind ▾] [Capture ⏎]  │
└──────────────────────────────────────────────────────────────────────────┘
```

Capture is a fixed bar at the bottom of the page, always there, always the
same height. An item shows the classifier's proposal (kind, destination,
project) as one line you accept or edit; promoting writes the card, issue,
thread or note and leaves a receipt in the item's history. Shared and private
inboxes are a segmented switch in the list head.

### Board

One board, every project, `Project` filter in the bar. Columns are the task
states; a card shows its project, origin glyph (inbox / GitHub / thread),
assignee (person or agent, with the live dot), and a one-line last-evidence
("tests pass · 4m"). A card opens a drawer: title, body, the timeline of
what happened (assigned → agent run → PR opened → review), linked issue/PR,
actions (assign to agent, open thread, archive). Columns are edited in the
same drawer shape. Flow templates ("instantiable kanban flows") appear as a
`Flow` chip on a card and are built in Studio.

### Threads

```
┌ list 300 ──────┬ thread ─────────────────────────────────────────────────┐
│ search         │ Fix anchor links           atlas · 2 agents · $0.14     │
│ Needs you 1    │ [Main ● sonnet] [Reviewer ● opus] [+ agent]  ← targets │
│ ● Fix anchors  │                                                         │
│ Working 2      │  you      The anchors 404 after the heading rename…     │
│ ◌ Build slower │  Main     Three anchors pointed at #install…           │
│ ◌ Release notes│           ▸ read docs/getting-started.md · 1.2s         │
│ Settled        │  Reviewer One of them is in the sidebar too.            │
│ · Dark theme   │                                                         │
│ · Flaky test   ├─────────────────────────────────────────────────────────┤
│                │ → Main  [ message…                               ] ⏎ 🎤│
│                │ neoproxy/default ▾ · ctrl+] next agent · 3 lines fixed  │
└────────────────┴─────────────────────────────────────────────────────────┘
```

The list settles: threads that need you first, working ones dimmed grey,
settled ones quiet. A thread hosts agents; each has a colour swatch and the
composer says who it is addressed to; `Ctrl+]` cycles, "all" broadcasts.
Tool calls are one-line rows folded under the prose by default. The
composer is a fixed 3-line region with its bar; it never grows. Spawning an
agent picks a template (Worker, Advisor, Chronicler, Judge, Warden, blank)
and shows the restrictions it carries as chips you can remove.

### Agents

Everything alive on the deck, across threads, cards and routines: one table
(name, template, model, where it is working, state: needs you / working /
parked / idle, tokens, cost, since). Below it, templates as cards: each a
named set of restrictions (visibility, lifecycle, spawn, model, prompt) with
the chips shown, not described. The right side of the page is the **judge
log**: the watcher's event feed across every session, newest first, with
"stuck", "needs you", "stopped unsanctioned fleet" as toned rows.

### Studio

The promoted canvas. Left list of graphs grouped by kind: **Flows**
(scheduled routines), **Pipelines** (request → inference → route → output),
**Routers** (virtual-model chains and fallbacks), **Classifiers**, **Board
flows** (kanban templates), and **Map** (the knowledge graph, read-only
here, edited in Knowledge). One canvas, one inspector, one run timeline
drawer. The node vocabulary changes with the kind; the editor does not.
Source (TOML/YAML) is a tab, not a different page.

### Knowledge

Notes on the left (tree with search), the note in the middle, and the map
toggled with `M` into the right third: the Obsidian-style graph focused on
the open note, backlinks as a list under it. Agents' edits appear as a
history line per note.

### Skills

Installed skills and the marketplace are two tabs on one page: a dense
table with provider, level, enabled switch, last used; the marketplace tab
lists catalog entries with install. A skill opens in a drawer with its
SKILL.md rendered.

### GitHub

Repositories as a table (default branch, integration branch, open issues,
open PRs, last nightly build). A repository opens its **wheel**: issues
ready → implementers running → PRs open → reviews → merged → nightly, as a
timeline/strip with counts, and the linked cards. Preview data until the
GitHub app exists.

### Usage

Your account: quota ring per pool (`neoproxy/default`, `small`, `heavy`),
what demotion chain applies, spend over time, requests table. Admins see
every user and can open NeoProxy. Preview data until NeoProxy accounts
exist.

### Settings

Sections as cards on one scrolling page with an in-page index on the left:
Engine (NeoPi tree, version, switch), Providers (what NeoProxy exposes,
hide/show per provider: the admin's filter), Accounts (users, roles, quotas),
Integrations (Telegram, GitHub app, MCP servers), Appearance (theme), and
**Advanced** (admin only, last in the index): environment variables, the raw
NeoPi `config.yml`, the deck's own config, each as a dense key/value table
with inline edit and a restart marker. Advanced is demoted, not exiled.

## 5. Model selection

No model list. The picker is a 320 px popover with three rows of chips:
**Roles** (`default`, `small`, `heavy`, …: what the admin mapped for you),
**Virtual models** you may use, and **Providers** as collapsible groups,
each group listing only the models exposed to you, with a search box that
filters across all three. Recent picks float to the top row. Everything is
named `neoproxy/<provider>/<model>` or `neoproxy/<name>`; the current pick
is printed in the composer bar in mono.

## 6. Data: live, preview, and the contract

Every page talks to a typed client in `apps/web/src/neo/client/<domain>.ts`.
Each client has a **live** adapter (existing deck endpoints) and a
**preview** adapter (in-memory fixtures). The registry in
`neo/client/index.ts` chooses per domain; a page whose data comes from a
preview adapter shows the `preview data` chip in its header. Nothing is
faked into the real backend. The endpoints the preview adapters stand in
for are specified in `docs/design/backend-contracts.md`.

| Domain | Live today | Preview |
| --- | --- | --- |
| auth, accounts | – | users, login, me |
| inbox | list/create/update/promote | classifier proposal, history |
| board | tasks, states, runs | flow chip, evidence timeline |
| threads | sessions, transcript, ws | agents per thread, cycle target |
| agents | subagents per session | roster across deck, templates, judge log |
| studio | routines + runs + canvas | pipelines, routers, classifiers, board flows |
| knowledge | files, graph | history |
| skills | skills, marketplace | last used |
| github | – | repos, issues, PRs, wheel |
| usage | – | pools, rings, chains, spend |

## 7. Decisions she can reject

1. No Home page; the Inbox carries the Today strip.
2. Marketplace folded into Skills as a tab; Mixtures and Advisors folded into
   Agents (a mixture is a graph in Studio, an advisor is a template).
3. The three-column shell with toggles is gone; detail opens in a drawer
   or a fixed detail column.
4. The composer is a fixed 3-line region; long messages scroll inside it.
5. Model picker is chips in a popover, never a scrolling list.
6. Legacy deck stays mounted at `/legacy` until parity.
7. Environment variables and raw NeoPi config live under Settings ›
   Advanced, admin only, as key/value tables rather than forms.
