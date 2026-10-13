# Telegram bridge

The standalone supervised Bun bridge connects a separate Telegram bot to the always-on npi-deck inbox and its persistent NeoPi sessions. Hermes remains independent. See the [source-based Hermes parity matrix](telegram-parity.md) for implemented capabilities and justified exclusions.

## Setup in Settings → Messaging

1. Create a **separate** bot with BotFather. Do not share its token with Hermes or another long-poll receiver. This bridge never pairs accounts, clears another receiver's webhook, or changes Hermes configuration.
2. Save **Bot token** and **Allowed users** (comma-separated numeric sender IDs, not usernames). Tokens are masked. Never copy credentials into logs or troubleshooting output.
3. For groups/supergroups, save **Allowed group chats** (`TELEGRAM_GROUP_ALLOWED_CHATS`), a comma-separated list of negative numeric chat IDs. A group needs **both** an allowed chat and an allowed sender. Blank disables groups. Bot messages, anonymous/channel senders and unauthorized traffic are silently ignored before downloads, session access or card creation.
4. **Require group mention** (`TELEGRAM_REQUIRE_MENTION`) defaults to true. Commands, `@botname` mentions and replies to this bot invoke it. Other conversation is dropped, not stored as context. Setting false accepts all messages from allowed senders in allowed groups. All allowed senders share the configured deck capabilities: this is a trusted-owner bridge, not a guest sandbox.
5. Click **Start**. Saving a token alone does not start anything. After configuration changes, click **Restart** for the bridge only. It does not restart NeoPi or replace the deck service.

Long polling requires outbound HTTPS, not a public inbound port. Telegram failure remains isolated in the bridge process. Settings provides running/crashed status and logs. The bot identity is fetched from Telegram at bridge startup; command suffixes for another bot are ignored. Commands are registered in the bot's menu.

## Inbox and kanban

DM text and invoked group text are **tasks by default**. They create `ticket` inbox items, then promote through the existing inbox API to kanban cards. This does not execute an agent or run a card (#101 owns execution). Plain prose produces one card. An explicit list with two or more top-level bullets, checklist items or numbered entries produces one card per item, retaining the introductory context and each item's continuation lines. This is deterministic first-pass decomposition, not an extra agent run.

Every resulting card retains leading YAML front matter:

```text
/task
---
read-only: true
worktree: /path/to/existing-worktree
model: provider/model
role: research
priority: high
custom-property:
  owner: Captain
cwd: /path/to/project
---
Investigate the routing:
1. Trace inbox receipt
2. Identify session ownership
```

`read-only` must be a boolean. `worktree`, `model`, `role`, `cwd` and `stateId`, when supplied, must be nonempty strings. Unknown YAML mapping keys, nested objects and lists are retained. The same merged card front matter begins **each** decomposed card body; the inbox provenance footer is appended after it. `cwd` and `stateId` are routing fields, removed from that property block: `cwd` separately sets the task's project assignment via `PromoteInboxItemRequest.cwd`, while `stateId` selects an existing kanban column. Neither is inferred from `worktree` or the deck default directory. Without explicit `cwd`, promotion leaves the task's project unassigned. No worktree is created or deleted by this bridge.

`/properties <YAML mapping>` persists defaults for this chat/topic; task front matter overrides defaults. `/properties` displays them and `/properties clear` clears them. Defaults survive bridge restarts and never bleed into another topic. `/capture <text>` saves an unprocessed capture only: it does not auto-file captures, ideas, decisions, investigations or email. `/inbox` lists the deck's unprocessed items.

If a multi-card task fails midway, already filed cards and received inbox items remain visible; inspect the inbox/board before resending. Filing is per card, not an all-or-nothing batch. A Telegram reply failure cannot undo a stored card.

## Commands and persistent sessions

All commands work in DMs and allowed groups, with optional `/command@botname` suffixes.

| Command | Behavior |
| --- | --- |
| `/start`, `/help`, `/commands` | Explain intake and list commands. |
| `/task <text>` | Explicit inbox→kanban intake (same as ordinary DM task text). |
| `/capture <text>`, `/inbox` | Save unprocessed capture; list unprocessed inbox items. |
| `/properties [YAML or clear]` | Set/display/clear conversation-scoped card defaults. |
| `/chat <text>` | Explicitly prompt the bound NeoPi session. Native NeoPi commands can be sent as `/chat /command`. |
| `/session`, `/status` | Show current conversation binding and workspace. |
| `/sessions` | List retained sessions for this chat/topic. |
| `/bind <deck session ID>` | Bind an existing deck session (ID from deck session picker/API). Reuse its live handle or resume its persisted transcript. |
| `/resume <session ID>` | Resume a retained session listed by this conversation's `/sessions`. Other conversations' history is not implicitly exposed. |
| `/new`, `/reset` | Detach current binding without destroying a live NeoPi or its transcript. Next `/chat` starts fresh; old sessions remain resumable. |
| `/stop` | Abort the bound turn immediately, bypassing its per-conversation queue. |
| `/title <name>` | Rename bound session. |
| `/model [provider/model]` | List/select session model via the deck API, not Hermes configuration. |
| `/compact [focus]` | Compact bound session via the deck API. |

Session bindings/history and card defaults live in `TELEGRAM_BRIDGE_DB_PATH` (default: the deck data directory's `telegram-bridge.db`). Existing chat-only DM mappings are preserved. Group/forum topics and DM topics have separate lanes; forum General consistently uses topic 1. Native direct-message topics are distinguished from message-thread topics. Every outbound chunk stays in its originating topic, including command replies.

`/chat` lazily creates a session if unbound. An inactive binding resumes its exact stored transcript through the deck; an active persistent NeoPi is reused. Resume failure is reported, **never silently replaced by an empty session**. `/new` is the explicit fresh-start choice. No command restarts NeoPi. Plan review stays in the deck web UI; Telegram refuses unreviewable proposals instead of hanging.

## Photos and unsupported media

Caption a photo with `/chat` and optional text. The largest size is downloaded and sent as an image attachment to NeoPi. A task caption instead files text cards; it does not pretend to attach the photo to the card. Location/venue pins can become text tasks. Uncaptioned unsupported media receives an explanation. Audio transcription, video/document extraction, TTS and outbound files require provider/protocol capabilities this deck does not expose; they are explicitly excluded rather than copied from Hermes.

Text replies stream through throttled edits (`TELEGRAM_EDIT_INTERVAL_MS`, default 700, 250–5000 allowed), with safe long-message chunking. `TELEGRAM_POLL_TIMEOUT_SECONDS` defaults to 30 (1–50 allowed); transport requests are bounded. Diagnostics remove the configured token and transport exceptions never expose credential-bearing URLs.

## Troubleshooting

- **No reply:** check Settings bridge status, numeric sender/group allowlists, correct bot suffix and mention policy. Unauthorized traffic deliberately has no outward response.
- **Polling conflict/webhook:** use a distinct bot token; stop/configure the conflicting receiver yourself. The bridge never modifies another receiver to take ownership.
- **Resume fails:** preserve the database and transcript; inspect deck session status. Use `/bind` to choose a known session or `/new` deliberately. Never delete a mapping database merely to hide a failed resume.
- **Credentials unavailable:** edit the masked Settings fields. Do not print the managed `.env` or bot token.
- **Slow replies:** inspect bridge/deck status and edit interval. The bridge supervises neither the live Hermes receiver nor a separate NeoPi installation.
