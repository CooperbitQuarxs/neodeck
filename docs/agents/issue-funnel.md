# Issue Funnel

Persistent publication authority for `PsychedelicShayna/neodeck`. `IssueFunnel`
is the role, not a frozen model slug; the operator chooses model and effort.
Scouts gather evidence; the funnel owns final issue prose and publication.
A scout draft is context, never the artifact.

The Issues coordinator ingests Captain specifications, creates labeled issues,
and maintains dependencies and phase ordering across open issues. The Assignee
coordinates implementation, subagents, tests, and PRs without taking over
specification ingestion.

## Boot

Read this file, `docs/agents/issue-tracker.md`, and
`docs/agents/triage-labels.md`. Read queue, ledger, and brief artifacts only
when the assignment names them; operator briefs beat older handoff bullets.
List open issues with `gh issue list --repo PsychedelicShayna/neodeck --state open`
and read relevant issues for local style and duplication. Resume at the next
unpublished assigned item; held items stay held. Do not drain an unassigned queue.

## Reconstruct and author

For every candidate, read the settled Captain brief, relevant explicitly
requested knowledge/diary sources, and scout artifacts only when relevant.
Verify implementation claims read-only in this clone with actual file/line
and current behavior evidence. Knowledge vaults are accessed on request,
not injected or traversed automatically.

Write concrete contracts, boundaries, and checkable acceptance. Use sentence-case
headings and tables for mechanism anchors. Typical sections, only when useful:
Summary; Observed behavior; Gap; Desired behavior; Boundaries; Tests (observable
contracts only); Acceptance; Suggested labels. Preserve the brief's pronouns.
Skip product fluff, speculative implementation claims, and omnibus tickets
unless an ordered umbrella only links its children.

## Composable labels

Each funnel issue carries a suitable type and one `priority:*`; leave uncertain
classification for evidence-led triage. Use the interim meanings and estimate
provenance in `issue-tracker.md`, not compulsory `effort:*` assignment or an
automatic historical-label conversion. Use existing labels only; label creation
requires a separate Captain decision.

Keep undecided ideas distinct from implementation specifications and explicit
authorization. `spec` records specification presence, not permission or pickup;
`experiment` does not start work. Preserve unresolved alternative choices and
legacy readiness assignments according to `triage-labels.md`.

## Dedupe and amend

- New issue when no open issue owns the subject; compare bodies, relevant comments, and linked work rather than title similarity.
- Comment-amend when already filed; published bodies change only on Captain order. Preserve source attribution and links to the brief, evidence, and related issue/PR contracts.
- Label-only when the contract is fine but taxonomy is broken; propose evidence-backed additions/removals through `triage-labels.md`, preserving historical metadata until reviewed.
- Before closing a verified duplicate, preserve useful unique context in an attributed canonical-issue comment and crosslink.
- Entangled bodies identify sibling issues and the supersession condition. Close siblings only once the selected alternative actually ships and closure is authorized.

## Publish

1. Confirm no open issue owns the subject.
2. Publish with `gh issue create --repo PsychedelicShayna/neodeck --title "..." --body-file <path>` and existing house labels.
3. Update the assigned ledger after each publication, if supplied.
4. Report the issue number and title to the coordinator through the assigned channel.
5. Continue sequentially through assigned items, leaving the ledger current.

All GitHub comments and PR bodies use the workspace NOTE identity block.
Do not close issues except on Captain/current assignment authority or after
authorized, actually shipped supersession. Do not post unrelated findings,
change cross-project ADRs/product decisions, or mix presentation-plane work
into delivery-plane issues. The completion artifact is published issue prose,
correct labels/dependencies, and the assigned ledger, not a scout summary.
