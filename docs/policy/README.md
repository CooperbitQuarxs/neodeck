# Repository policy

The workspace policy governs branches, commits, signing, pull requests, merging,
labels, and GitHub posting. This file holds the repository-specific values;
nothing here adds a confirmation step.

## Branches

| Role | Branch | Local checkout | Ships as |
| --- | --- | --- | --- |
| Default (promoted) | `main` | `~/source/github/PsychedelicShayna/neodeck` | Installed snapshot `~/.local/share/npi-deck`, served by `npi-deck.service` |
| Integration | `nightly` | No standing checkout; topic worktrees start from `origin/nightly` | Verification only; does not replace the live snapshot or service |

- Topic branches: from the repository checkout, `git fetch origin && git worktree add ../neodeck-wt-<slug> -b <type>/<slug> origin/nightly`.
- PRs target `nightly`. `hotfix/` PRs target `main`, followed by a PR merging `main` back into `nightly`.
- Upstream is `Shreyans13/omp-deck`, GitHub's fork parent. The old `bjb2/omp-deck` no longer exists. The local `upstream` remote still points there; changing it awaits the Captain's answer. Syncs use `sync/<date>` into `nightly`; see `docs/agents/upstream-sync.md`.
- Repository URLs use `PsychedelicShayna/neodeck`. Package scopes `@npi-deck/*`, `NPI_DECK_*` variables, state and install paths, launcher names, and service names retain their installed-runtime identity until a separate rename issue.

## Merging

- Merge commits only (`gh pr merge --merge`). Subject: `Merge PR #<number>: <conventional PR subject> (@<author>)`.
- The authoring agent merges its own PR into `nightly` once the workspace gates pass, unless the assignment reserves merging to another agent or the Captain. Review bots (`docs/agents/pr-review-bots.md`) are advisory and requested at the agent's discretion.
- Contributor heads (any author other than the owner) are never executed on the owner's machine; see `docs/agents/pr-review-bots.md` › Running PR code.

## Promotion

`nightly` is promoted into `main` weekly by `.github/workflows/promote-nightly.yml`:
it opens a `sync/promote-<date>` PR and merges with a merge commit when repository
gates pass. A refused merge leaves the PR open with `ready-for-human` and fails
the run. The owner may run `gh workflow run promote-nightly.yml`.

Scheduled runs and `workflow_dispatch` require the workflow on the default
branch. The Captain performs the first nightly-to-main promotion after this
workflow lands in `nightly`; subsequent runs are available once it reaches `main`.

## Releases

Existing upstream-inherited tags use `vX.Y.Z` (currently `v0.1.0` through
`v0.6.1`). Fork releases, when they start, follow neopi's
`v<upstream>-<fork>.<YYYYMMDD>` pattern. This structure change creates no tags
and does not introduce a fork release or change package versions. Branch
promotion is separate from tagging and does not reinstall the live snapshot.

## Labels

The interim tracker policy is in `docs/agents/issue-tracker.md`; evidence-led
daily reconciliation, available additions, and held migrations are in
`docs/agents/triage-labels.md`. The complete setup skill and participation
vocabulary are not finalized.

- Type and GitHub defaults: `bug`, `enhancement`, `documentation`, `duplicate`, `invalid`, `good first issue`, `help wanted`; composable `idea`, `experiment`, and specification-presence `spec` are also available.
- Priority: `priority: p0` … `priority: p3`. Estimates: eight `difficulty:*` intervals and `frame: hours`, `frame: days`, `frame: weeks`, `frame: months`, `frame: years`, with independent meanings and provenance in the tracker policy. Historical `effort:*` labels remain reviewable metadata, not compulsory assignments or literal durations.
- Issue triage: `needs-triage`, `needs-info`, `wontfix`; preserve `ready-for-agent` and `ready-for-human` as legacy markers pending evidence-based reconciliation.
- PR state remains `needs-review`, `ready-for-merge`, `review-stalled`. Accepted target `mergeable` awaits coordinated parent-policy/consumer migration; it changes neither merge permission nor review gates.
- Other shared labels: `accessibility`, `downstream`, `hotfix`, `entangled`, `stale: identical`, `stale: similar`. Accepted target `upstream` means substantive upstream involvement; current operational `upstream-sync` remains until coordinated migration. `baseline` retirement is undecided.
- Retained historical associations include `question`, `neopi-upstream`, `codex-review`, `sentinel-review-requested`, and `wayfinder:*`; these are not new triage recommendations. The deselected-label rule and preservation of current required operational names are in `docs/agents/triage-labels.md`.

This documentation cutover neither relabels/closes issues nor removes existing
labels. Preserve historical estimates and other metadata until reviewed.

## Where the rest lives

| Topic | File |
| --- | --- |
| Repository conventions and workflow pointers | `AGENTS.md` |
| Installation and runtime configuration | `docs/install.md`, `docs/configuration.md` |
| Fork placement and compatibility checks | `docs/agents/fork-maintenance.md` |
| Upstream sync procedure | `docs/agents/upstream-sync.md` |
| Review-bot mechanics and owner-head safety | `docs/agents/pr-review-bots.md` |
| Issue tracker, funnel, triage labels | `docs/agents/issue-tracker.md`, `docs/agents/issue-funnel.md`, `docs/agents/triage-labels.md` |
| Domain documentation | `docs/agents/domain.md` |
