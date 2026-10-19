# Repository glossary

Project overview: [README.md](README.md). Policy and mechanics:
[docs/agents/policy.md](docs/agents/policy.md). Architectural decisions live in
`docs/agents/adr/` when present.

| Term | Meaning here |
| --- | --- |
| NeoDeck / deck | This web cockpit and fleet console, forked from `Shreyans13/omp-deck` |
| NeoPi | `PsychedelicShayna/neopi`, consumed in-process through its SDK; cross-repo capability contracts are linked in issue bodies |
| Upstream | The source project is involved in synchronization, compatibility, conflict avoidance, or divergence; not synonymous with every base defect |
| Downstream | A project consuming this one; NeoDeck requests carry this relationship on the NeoPi-side contract |
| ITL | In the loop: human participation is needed; the human may work through an agent |
| OTL | Out of the loop: specified work can proceed unattended by an agent |
| Pending | Ready for the named actor to pick up; not blocked by missing information or entanglement |
| Started | A claim on work, warning others not to duplicate it; not a live activity heartbeat |
| Finished | The named actor's agreed part is done; review, CI, another actor's work, or promotion may remain |
| Triage | Two-pass evidence-led classification, relationship checking, and daily reconciliation; distinct from implementation pickup |
| Entangled | Incompatible alternatives awaiting the owner's choice; ordinary dependencies are not entanglement |
| Idea | An undecided possibility, not permission to implement |
| Spec | An implementation specification is present; completeness and authorization still require evidence |
| Experiment | Authorized exploration on an `experimental/` branch, not ordinary integration/default work |
| Difficulty | Complexity/uncertainty/risk estimate in eight bands over [0, 1], independent of time or priority |
| Frame normalization | Agent duration estimates lowered exactly one unit once, with hours as floor; human estimates unchanged |
| Review requirement | `review: codex` identifies the configured reviewer, not the result of a round |
| Review state | Requested, open, closed, or stalled evidence for a reviewer; a recorded round plus the review guide's fix assessment or base-only comparison can establish state on a later head |
| Mergeable | All documented repository merge criteria pass; neither actor completion nor GitHub's no-conflicts flag alone, and not authority to merge |
| Integration | `nightly`, where topic PRs merge and are verified without replacing the live installation |
| Promotion | Owner-approved merge from `nightly` to `main`; NeoDeck fixes remain open until complete acceptance reaches `main` |
| Baseline | A defect already on the base during review, which may be fork-local rather than upstream |
| Wayfinding map | An umbrella with native sub-issues and dependency links; relationships do not require map-specific labels |
