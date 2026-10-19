# Issue tracker: GitHub

Issues and specs live in `PsychedelicShayna/neodeck`. Use `gh` and pass
`--repo PsychedelicShayna/neodeck` on every issue, PR, and label operation:
fork discovery may otherwise resolve to `Shreyans13/omp-deck`.

This is the interim tracker policy, not a finalized setup skill or participation
lifecycle. Label availability does not authorize implementation or bulk relabeling.

## Conventions

- Create: `gh issue create --repo PsychedelicShayna/neodeck --title "..." --body-file <path>`.
- Read: `gh issue view <number> --repo PsychedelicShayna/neodeck --comments`, including labels.
- List: `gh issue list --repo PsychedelicShayna/neodeck --state <state> --json number,title,body,labels,comments` with task-specific filters.
- Apply or remove existing labels: `gh issue edit <number> --repo PsychedelicShayna/neodeck --add-label "..."` or `--remove-label "..."`.
- Closure follows [evidence-led triage](triage-labels.md#evidence-led-triage): verify the full acceptance and any explicit promotion condition, then record the implementation/merge proof. NeoDeck's existing condition keeps fixes open until default-branch promotion; a nightly merge alone does not satisfy it. Verified duplicates and owner-ordered closure remain separate cases. The Issue Funnel's narrower publication authority is defined in `docs/agents/issue-funnel.md`.
- Posting follows workspace policy. Every GitHub comment and PR body opens with `> [!NOTE]` and `> <actual Model Name> on behalf of PsychedelicShayna`; Codex trigger comments use only the trigger phrase.
- Use existing labels only; creating or changing label definitions requires a Captain decision.

## Pull requests as a triage surface

**PRs as a request surface: no.** GitHub shares one number space across issues
and PRs; resolve an ambiguous number before acting.

## Skill meanings

- "Publish to the issue tracker" means create a GitHub issue.
- "Fetch the relevant ticket" means read the issue, comments, and labels.

## Composable labels

Type, source/relationship, estimates, specification presence, and participation
or readiness record distinct facts. Apply the layers supported by evidence;
they are not one mutually exclusive classification.

| Layer | Labels | Rule |
| --- | --- | --- |
| Type and intent | `bug`, `enhancement`, `documentation`, `accessibility`, `idea`, `experiment` | Use appropriate labels; meanings below |
| Priority | `priority: p0` … `priority: p3` | Exactly one once triaged |
| Estimates | Eight `difficulty:*` buckets; five `frame:*` units | Independent estimates with provenance; see [Sizing](#sizing) |
| Specification | `spec` | An implementation specification is present, not permission to implement |
| Triage and legacy readiness | See `docs/agents/triage-labels.md` | Preserve evidence and existing legacy assignments |

- `idea` records an undecided possibility, not implementation authorization.
- `spec` means the issue is or contains an implementation specification, optionally in a collapsible `<details>` section. Headings or checkboxes alone do not turn brainstorming into an agreed spec. It implies neither authorization, current agent activity, nor merge eligibility.
- `experiment` composes with `idea`, `bug`, and other applicable labels. Authorized experimental work uses an `experimental/` topic branch; entering `nightly` or the default branch needs a separate owner decision. A label alone starts no work.
- `entangled` identifies incompatible alternatives: choosing one supersedes the others. Ordinary dependencies or related issues are not entangled. Record the alternatives and supersession condition, and preserve the unresolved owner choice rather than AFK-implementing an alternative.
- Existing `neopi-upstream` associations record historical NeoPi dependencies; link the dependency contract rather than assigning that deselected label anew. Broader upstream involvement and held label renames are defined in `docs/agents/triage-labels.md`.

Publication authority remains in `docs/agents/issue-funnel.md`.

### Priority

| Label | Meaning |
| --- | --- |
| `priority: p0` | Blocks current work or handles an active incident |
| `priority: p1` | High value or prerequisite for several issues |
| `priority: p2` | Useful planned work |
| `priority: p3` | Backlog or opportunistic work |

## Sizing

Difficulty measures how hard the work is, independently of time and priority.
Frame measures duration. Fresh agent estimates concern a competent AI agent
with tools and subagents; preserve human estimates as authored.

### Difficulty

Difficulty is in `[0, 1]`: `0` is a mechanical one-line change; `1` is the hardest
work the project will attempt. Weigh complexity, uncertainty, regression risk, and
cross-repo coordination. Preserve the estimator and source of an estimate.

| Label | Range |
| --- | --- |
| `difficulty: 0.000-0.125` | `0.000 ≤ d < 0.125` |
| `difficulty: 0.125-0.250` | `0.125 ≤ d < 0.250` |
| `difficulty: 0.250-0.375` | `0.250 ≤ d < 0.375` |
| `difficulty: 0.375-0.500` | `0.375 ≤ d < 0.500` |
| `difficulty: 0.500-0.625` | `0.500 ≤ d < 0.625` |
| `difficulty: 0.625-0.750` | `0.625 ≤ d < 0.750` |
| `difficulty: 0.750-0.875` | `0.750 ≤ d < 0.875` |
| `difficulty: 0.875-1.000` | `0.875 ≤ d ≤ 1.000` |

Historical difficulty title prefixes may retain an evidenced estimate
(`0.35 - …`). A number alone does not establish that provenance. Map the exact
evidenced value to its bucket (`0.12` is in the first; `0.13` in the second),
without inventing precision or rewriting titles in this interim cutover.

### Frame

Available units are `frame: hours`, `frame: days`, `frame: weeks`, `frame: months`,
and `frame: years`. For a fresh agent-authored estimate, normalize down exactly
one step: years → months → weeks → days → hours, with hours as the floor.
Human-authored estimates remain unchanged.

Record the estimator, original unit, and normalization in the issue body or an
attributed comment. Later triage reuses that provenance rather than shrinking
the same estimate again. Keep existing estimates unless evidence supports a
change. Larger frames may warrant splitting into independently deliverable work.

### Effort and legacy sizing migration

`effort:*` is not literal time and cannot be auto-converted to difficulty or
frame. Compulsory effort assignment and the effort-replacement migration are
retired by this interim policy. Existing issue labels and other historical
metadata stay until reviewed; this documentation change does not relabel issues.

## Upstream requests (NeoPi)

NPI deck consumes NeoPi (`PsychedelicShayna/neopi`) in-process. When the deck
needs a new SDK export, RPC field, memory API, or event shape, the deck lead
files a NeoPi issue and the NeoPi-side agent implements it there.

- That issue is the contract: exact field names, capabilities, types, and events.
- Amend the contract by commenting on the NeoPi issue before merging a change to it.
- The consuming deck issue links the NeoPi issue. Retain existing `neopi-upstream` associations pending reviewed cutover; do not recommend new triage assignments.
- Unresolved disagreements go to the operator. Cross-project ADRs and product decisions remain owned by their project.

## Wayfinding operations

Historical `/wayfinder` maps may carry `wayfinder:map` and children
`wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or
`wayfinder:task`. Preserve existing associations; the deselected family is not
recommended for new triage assignments. Link children as native sub-issues
(or a task list plus `Part of #<map>` when unavailable).

Dependencies use GitHub's native issue dependencies: POST
`repos/PsychedelicShayna/neodeck/issues/<child>/dependencies/blocked_by` with
`issue_id=<blocker database id>` (not the issue number or node ID). If native
dependencies are unavailable, use `Blocked by: #<n>` in the body. An issue is
unblocked when all blockers are closed. Claim the first unassigned, unblocked
child in map order with `gh issue edit <n> --repo PsychedelicShayna/neodeck --add-assignee @me`.
Resolve with an answer comment, close only when authorized, and append the
answer link to the map's Decisions-so-far.
