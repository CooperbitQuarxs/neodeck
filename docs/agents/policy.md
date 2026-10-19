# Repository policy

This repository carries its branches, commit, review, tracker, and merge policy
so a fresh clone has the instructions it needs. `AGENTS.md` routes to these
mechanics; `README.md` describes the project. This is an iterative policy, not
a setup-skill implementation.

## Branches

| Role | Branch | Ships as |
| --- | --- | --- |
| Default (promoted) | `main` | Installed snapshot `~/.local/share/npi-deck`, served by `npi-deck.service` |
| Integration | `nightly` | Verification only; does not replace the live snapshot/service |

Start topic work from a freshly fetched remote integration branch in its own
worktree:

```sh
git fetch origin
git worktree add ../neodeck-wt-<slug> -b <type>/<slug> origin/nightly
```

Types: `fix/`, `feat/`, `docs/`, `ci/`, `experimental/`, `chore/`, `refactor/`,
`test/`, `sync/<date>`, and necessary `hotfix/`. Ordinary PRs target `nightly`.
Hotfixes target `main` and require an immediate PR merging `main` back into
`nightly`; only the owner merges into `main`. Experiments remain on
`experimental/` branches unless the owner separately decides to integrate them.
Agents leave default/integration branch history to merged PRs; no direct
commits, pushes, resets, rebases, or force-pushes there. Preserve local drift
and unrelated work rather than committing it as part of a topic.

Upstream is `Shreyans13/omp-deck`, GitHub's fork parent. The old `bjb2/omp-deck`
no longer exists; changing the local `upstream` remote awaits the Captain's
answer. Follow [upstream-sync.md](upstream-sync.md) for releases on `sync/<date>`
into `nightly` and [fork-maintenance.md](fork-maintenance.md) for compatibility.
Keep fork contracts when integrating upstream. Repository slug changes do not
rename `@npi-deck/*`, `NPI_DECK_*`, state/install paths, launchers, or services.

## Commits

Commit small logical changes with a Conventional Commit headline:
`type(scope): imperative summary`, at most 72 characters. The prose body says
what changed, why, and verification actually performed. Put `Fixes #<n>` on its
own line only when the change completes the issue. Include both actual-model
trailers:

```text
Model: <provider>/<model-id>
Co-authored-by: <Model Name> <noreply@provider-domain>
```

Explicitly select the agent SSH signing key for each commit:

```sh
git commit -S/home/shayna/.ssh/id_ed25519_github_signing_agents.pub -m '<headline>' -m '<body and trailers>'
git verify-commit HEAD
```

Push only verifiable signatures. Keep published fixups as new commits; preserve
history rather than amending or force-pushing. Commit intentional files only,
with no secrets or unrelated generated output. Remove the worktree and local
topic branch after its PR is merged or closed.

## Pull requests and posting

Use one PR per issue and the exact headings/order/checklist in
`.github/PULL_REQUEST_TEMPLATE.md`; check only true items and explain skipped
checks beside unchecked boxes. Title uses the commit's Conventional Commit
form. Declare `Depends on #<n>` for dependencies and merge them first.

Every issue and PR gets a kind, priority where assessed, and relevant state from
[triage-labels.md](triage-labels.md). Intake uses `needs-triage`; every PR carries
`review: codex` plus its evidenced current-head review state. Follow
[triage.md](triage.md) for daily reconciliation and readiness rather than treating
labels as authorization.

Every GitHub comment, issue, review reply, and PR body begins:

```text
> [!NOTE]
> <Model Name> on behalf of PsychedelicShayna
```

The authoring agent may push its topic, post on its PR, file baseline issues,
apply the policy's labels, and merge its PR into integration after the gates.
Other PRs, repository settings/rulesets/protection, and posting elsewhere stay
outside that authority. Changes to workflows go through their own PR. Contributor
heads are read-only on the owner's machine; use the owner-head rule in
[pr-review-bots.md](pr-review-bots.md#running-pr-code).

## Merging

The authoring agent merges its own PR into `nightly` promptly when all criteria
pass, unless its assignment reserves merging to another agent or the Captain:

- Full requested behavior and acceptance complete, relevant docs/callers current.
- Complete clean Code Review on the final head and every finding answered,
  including unsolicited rounds: [pr-review-bots.md](pr-review-bots.md).
- Required checks green, or a documented identical base failure with its
  `baseline` issue and evidence under the review procedure.
- Up to date with the base, dependencies merged, and any explicitly required
  review/authorization satisfied. Retain the outer policy's
  `sentinel-review-requested` requirement where present; this iteration adds no
  reviewer or new security pass.

Apply `mergeable` only when those criteria pass. Merge commits only:
`gh pr merge --merge`, subject
`Merge PR #<number>: <conventional PR subject> (@<author>)`. No squash or rebase.
After merging, recheck dependent/open PRs and bring the new base into topic
branches with merge commits, not rebases. Regressions on integration are reverted
through a PR. Never merge into `main` as an agent; promotion is the owner's
choice. Leave an open PR only with a stated reason.

A workflow change triggered only after landing cannot exercise itself through
its own PR. Keep it single-purpose, watch its first eligible integration/default
run, and revert through a PR if it fails.

## Promotion

`.github/workflows/promote-nightly.yml` runs monthly and on `workflow_dispatch`
to **open the promotion PR only**, with `human: pending`; the owner merges
`nightly` into `main`. Automation does not merge into the default branch.

Scheduled/dispatch execution requires the workflow on the default branch.
The Captain performs the first promotion after it lands on `nightly`; watch the
first eligible run after it reaches `main`. Workflow landing or promotion does
not authorize reinstalling the live snapshot or restarting its service.

NeoDeck fixes stay open until the complete acceptance is promoted to `main`;
merging a linked PR to `nightly` alone does not close them. Closure mechanics
are in [triage.md](triage.md#closure).

## Releases

Existing upstream tags use `vX.Y.Z` (`v0.1.0` through `v0.6.1`). Fork releases,
when introduced, follow NeoPi's `v<upstream>-<fork>.<YYYYMMDD>` pattern. Policy
changes create no tags or versions. Promotion is separate from tagging and
live deployment; [installation](../install.md) owns runtime setup.

## Mechanics

| When | Read |
| --- | --- |
| Classifying, claiming, reconciling, or closing issues | [triage.md](triage.md), [triage-labels.md](triage-labels.md) |
| GitHub commands, estimates, NeoPi contracts, wayfinding | [issue-tracker.md](issue-tracker.md) |
| Publishing Captain specifications | [issue-funnel.md](issue-funnel.md) |
| Requesting review, answering findings, or merging | [pr-review-bots.md](pr-review-bots.md) |
| Exploring terminology or architectural decisions | Root `CONTEXT.md`, [domain.md](domain.md), `docs/agents/adr/` when present |
| Fork placement or synchronizing upstream | [fork-maintenance.md](fork-maintenance.md), [upstream-sync.md](upstream-sync.md) |
