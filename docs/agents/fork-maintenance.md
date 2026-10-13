# Maintaining fork behavior across upstream updates

NPI deck is the `PsychedelicShayna/neodeck` fork of `Shreyans13/omp-deck`.
The old `bjb2/omp-deck` repository no longer exists; leave the local upstream
remote unchanged until the Captain decides its replacement.

## Placement of new behavior

Before adding fork behavior, locate the upstream owner and inspect existing
extension hooks and shared utilities. Prefer supported hooks when they can
express the complete behavior, including cancellation, persistence, and
session changes. Keep substantial fork-specific logic in focused modules;
make required core integration points narrow and explicit. Extend the existing
owner when it must enforce a lifecycle or protocol invariant.

A new file alone does not isolate code that copies upstream internals or relies
on their incidental order. Record the missing extension capability and the
observable contract requiring a core change in the PR or design document.
Test through the consumer, reuse shared utilities, and keep unrelated upstream
refactoring out of the change.

Deck compatibility boundaries include the pinned NeoPi SDK (`neopi.pin`),
multi-session chat and streaming, canvas/cards and front matter, approvals,
worktree routing, messaging bridges, and launcher/setup behavior. Preserve
`@npi-deck/*`, `NPI_DECK_*`, installed paths, `npi-deck`, and `npi-deck.service`;
repository renaming alone does not authorize runtime rebranding.

## Integrating an upstream release

Follow `docs/agents/upstream-sync.md`. Pin the source fork commit, upstream
release commit, and relevant open PR heads before resolving conflicts. Use a
fresh worktree from `origin/nightly` and preserve recovery refs.

Review every fork integration point, including automatically merged files.
Determine whether upstream preserves, replaces fully, overlaps partly, or
conflicts with each contract; a clean textual merge is not compatibility proof.
Keep open PRs separate until their contracts are compared with upstream.
Preserve requirements not actually replaced and report the recommended merge
order and unresolved behavior decisions before promotion.

Validate upstream regressions and deck contracts at affected boundaries.
Record exact results separately from unavailable checks. Verification and
staged installs must leave the live snapshot, state, display, and service
untouched. Installation details live in `docs/install.md`; synchronization is
not permission to deploy to the live installation.
