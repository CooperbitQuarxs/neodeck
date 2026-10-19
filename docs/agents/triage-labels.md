# Triage labels

This interim policy records settled meanings and the current operational names.
The full setup skill and participation lifecycle remain unfinished. Available
labels are not implementation authorization.

## Triage and legacy readiness

| Label | Meaning |
| --- | --- |
| `needs-triage` | Evaluation or an unresolved policy decision is needed |
| `needs-info` | Required information is missing; identify what is needed |
| `ready-for-agent` | Legacy marker for fully specified AFK-agent readiness |
| `ready-for-human` | Legacy marker for human implementation or intervention |
| `wontfix` | Will not be actioned |

Preserve existing `ready-for-agent` and `ready-for-human` assignments pending
evidence-based reconciliation. They do not confer new authorization. Human/agent
pending, started, and finished participation is still under discussion, with no
replacement spellings selected. Started would communicate active ownership;
finished would concern that participant's work, not universal PR mergeability.
Do not create actor-state aliases or treat these concepts as deployed labels.

## Available additions and held migrations

The shared names now include `accessibility`, `bug`, `documentation`,
`downstream`, `duplicate`, `enhancement`, `entangled`, `hotfix`, `idea`, `invalid`,
`needs-info`, `needs-triage`, `priority: p0` … `priority: p3`, all eight
`difficulty:*` buckets, `frame: hours/days/weeks/months/years`, `stale: identical`,
`stale: similar`, `wontfix`, `experiment`, and `spec`. Frame shorthand denotes five
separate labels. Existing associations remain until reviewed, not as blanket
recommendations for new assignments. Availability does not mean issues have
been relabeled or closed. Composition, idea/spec/experiment, alternatives, and
sizing are defined in [the tracker policy](issue-tracker.md).

Deselected non-operational labels, including `rpc`, `t3c-npi`, `npi-deck`,
`neopi-upstream`, `codex-review`, `sentinel-review-requested`, and the
`effort:*`, `size:*`, `vouch:*`, and `wayfinder:*` families, are not recommended
for new triage assignments. Preserve existing associations until reviewed
cutover. Current required PR/readiness operational names remain in force until
replacement is decided; this does not disable current gates.

- `stale: identical` requires evidence that the requested behavior is already implemented essentially as specified; verify all acceptance before recommending closure.
- `stale: similar` means a partial or different implementation, not automatic closure.
- `upstream` is the accepted target for substantive upstream involvement, not only release synchronization. A fork-local manifestation does not disprove upstream origin. The operational name remains `upstream-sync` until parent policy and literal consumers migrate together; do not rename or create the target in this interim cutover.
- `baseline` does not automatically mean upstream. Whether to retire it remains open; no blanket removal is authorized.
- `mergeable` is the accepted target for meeting repository-specific documented merge gates. The operational name remains `ready-for-merge` until coordinated cutover. It neither changes review gates nor grants an agent permission to merge the default branch.

## Evidence-led triage

Reconcile at least daily. Until the owner creates a dedicated triage role, use
the built-in commit role (`@commit`, resolved at runtime), not a frozen model
slug or a swarm. This requirement adds no scheduler or workflow.

1. Read issue and linked PR bodies, relevant issue/PR comments, PR review bodies and inline comments/threads, current labels, linked implementation, and acceptance. Check actual merged state: a closed unmerged PR is not implemented work, and an author's claim is not independent CI/review proof. Review tangible changed behavior rather than unrelated upstream defects; reuse existing ownership and acceptance work.
2. Produce an evidence-linked proposal with current labels, proposed additions/removals, issue-state recommendation, confidence, supporting source links, and unresolved policy decisions. An authorized integration owner reviews and applies verified changes. Keep unclear cases in `needs-triage` or `needs-info` as appropriate.
3. Compare suspected duplicates by their bodies and relevant discussion, not titles alone. Preserve useful unique context in an attributed canonical-issue comment and crosslink before closing a verified duplicate.
4. For implementation closure, verify every acceptance criterion and any explicit promotion condition; record the actual merge and proof. Automatic GitHub closure normally waits for the default branch, so a nightly merge may leave an issue open. Apply NeoDeck's existing promotion condition in [tracker conventions](issue-tracker.md#conventions), not an assumed new readiness state. Never close an umbrella for a partial PR or reopen correctly completed work merely because a new follow-up exists.
