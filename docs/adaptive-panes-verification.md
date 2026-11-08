# Personal fork: verification and limits

This fork starts from upstream v0.1.13, commit
`93b097f6e29fcb2d90a30dea2f03ce4e5dee7981`.
The public branch contains one aggregate commit, without the private development history.
Its runtime source and optional sidebar match the local development branch byte for byte.
The public README and this record contain no private installation paths, terminal identities, or screenshots.

## Behavior

The option is `"arrangement": "auto"` in the active-tab block's content.
Auto mode chooses the fewest balanced rows that give each pane 360 logical pixels of content width.
Height and aspect ratio do not add rows when width is sufficient.
For unchanged pane membership, fewer rows require 24 extra logical pixels per pane.
Membership changes and width reductions past the target recalculate immediately.
If one column cannot meet the target, each pane gets its own row.

The projection does not change saved splits, pane order, IDs, terminal ownership, mod instances, focus, or zoom.
Shared geometry accounts for padding, borders, frames, and headers.
Custom nested containers, stacks, fixed pixel sizes, and minimum/maximum constraints keep their manual arrangement.
Automatic boundaries cannot be dragged. Manual mode restores the saved splits.

The optional `extras/mods/personal-agents/` resource is not part of the shipped defaults.
It displays adopted and unadopted descendants as one nested forest.
Working descendants keep a parent visually Working. Blocked status takes priority.
This inherited status does not change agent reports or terminal ownership.
The resource contains the existing mod code, manifest, and 20 tests, not personal configuration or mod storage.

## Verification provenance

The local column-first implementation came from source commit
`afcc1daca395f17de05a1fd0e87875488eb92565`.
The coordinator verified and installed a build from that local commit, not from the later public aggregate commit.
The sidebar was developed and verified separately before its code and existing tests were copied into this repository.
Byte-equivalent source does not establish that a new public-branch binary was built or installed.

Before the policy correction, the GPUI regression failed with two rows for two panes in a 1200-by-1600 context.
After the correction, the same scenario passed.
It covers width thresholds, resize jitter, membership changes, addition/removal, and the return to columns.
It also checks saved structure, retained identities, focus/zoom, manual fallback, and predicted versus rendered terminal dimensions.
The framed/padded cases include top, bottom, and hover headers.

Local automated verification used Rust/Cargo 1.95.0, Zig 0.16.0, and Bun 1.4.4:

- Native debug suite: 348 passed, 1 ignored. The headless GPU pixel harness passed.
- Six script suites: 33 passed, with 458 assertions.
- Documentation tests: 4 passed, with 29 assertions. Reference checks passed for six pages.
- Focused release checks passed: adaptive wrapper (1), layout (10), model (16), and layout-sync (4).
- The optimized local artifact built with the unchanged release profile.
- The optional sidebar's existing tests: 20 passed. The coordinator also reported native mod validation.

The coordinator reviewed multi-pane transitions in an isolated Linux sandbox:

- Two panes appeared side by side.
- Four panes used two rows when four readable columns did not fit.
- A narrow context produced four rows.
- Removing the fourth pane restored three columns.
- Terminal processes and mod instances remained unchanged during reflow.

The coordinator's actual-window review covered one active pane only, not those multi-pane transitions.
The sidebar's coordinator review covered Working, Blocked, and Done states in an isolated sandbox.
No private configuration, screenshots, or installation receipts are distributed with the optional resource.

## Repeatable checks

Use the prerequisites in the [README](../README.md#build-from-source).
Run native checks with an isolated app home, temporary storage, and no access to the real core or display.
The existing core-dependent test remains ignored without a separate test core.

```sh
cargo test --locked
node --test extras/mods/personal-agents/tests/sidebar.test.cjs
bun test ./scripts/files.test.ts ./scripts/picker.test.ts ./scripts/palette.test.ts ./scripts/agents.test.ts ./scripts/spaces.test.ts ./scripts/worktree.test.ts
bun test ./scripts/docs.test.ts
bun scripts/docs.ts check
```

The documentation checker uses an existing debug binary. Build it first with `cargo build --locked` when necessary.
The sidebar tests use synthetic snapshots and a mocked rendering API. They do not replace native mod or visual checks.
`herdr-app check <path-to-mod>` validates a mod without installing it. Use an isolated home for that check.

## Public-source checks

The sanitized public worktree passed the full native debug suite: 348 passed, 1 ignored, plus the headless GPU pixel harness.
The six script suites and documentation tests passed together: 37 tests, 487 assertions.
The copied sidebar passed its 20 existing tests in both local and public trees.
The native mod checker passed for both copies in an isolated Linux namespace with `ZED_HEADLESS=1` and no display access.
Reference and CLI-example checks passed for six pages.
These checks did not install the public branch or repeat the coordinator's visual review.

## Remaining limits

Verification covers Linux only. Windows and macOS were not verified.
The native test `two_app_viewers_answer_queries_without_idle_size_theft` requires an isolated running core.
The full release suite is not green: four upstream GPUI debug-selector tests fail with the unchanged release profile.
The failures were reproduced on the original upstream baseline and are not hidden by weaker assertions or reduced optimization.
The full release suite was not rerun for the column-first correction or public packaging.
Private verification artifacts are not included in this public branch.
