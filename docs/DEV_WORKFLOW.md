# Development workflow

How we propose, review and land changes in this repo. Keep it lightweight: small
MRs, one reviewer minimum, tests green before merge.

## Branches and merge requests

- Never push to `main` directly. Work on a feature branch and open a merge
  request against `main`.
- Branch names: `feat/<topic>` for features, `docs/<topic>` for documentation,
  `test/<topic>` for test-only changes.
- Rebase onto the latest `main` before requesting review. A force-push resets
  existing approvals, so ping your reviewer to re-approve after a rebase.
- Domain ownership keeps MRs small: engine/combat/companions/balance, map/zones,
  items/inventory/shops/bag, story/tests, UI/save/audio. Cross-domain changes
  get a note in chat before you start.

## Reviewer checklist

1. Read the full diff — added lines, not just the summary — including any new
   untracked files the diff view may not show.
2. Verify prose claims against the code (prices, stats, flags, gating).
3. Run the content guards: the domain tests enforce an off-theme content regex;
   keep every added string, label and filename inside the storm-coastal fantasy
   theme. Strip `class="…"` attributes before scanning rendered HTML, and scan
   with word boundaries so ordinary words do not false-positive.
4. Art review: zone and scene art uses angular `<path>` linework consistent
   with the storm aesthetic; flag smooth primitives (ellipse, circle) in new
   SVGs.
5. Run the full suite (`npm test`) in a clean checkout or detached worktree.
   When two MRs touch shared tails (`style.css`, `main.js` install order),
   test-merge them together before approving either.
6. Record the review as an approval plus a short note describing what was
   verified.

## Landing a merge

- Confirm the approvals via the API approvals endpoint (the MR detail view can
  lag), confirm the head commit has not moved, then merge.
- After merging, rebase any in-flight branches that touched the same files.
  Tail-append conflicts in `style.css` are the most common; keep both blocks.

## Testing quick reference

- `npm test` runs the whole suite (`node --test` over `tests/*.test.js` and
  `tests/*.test.mjs`). Run a single new file first, then the full suite.
- End-to-end shop flows: build a fresh state, travel to the zone, interact with
  the shop interactable, then call the shop API — see existing tests for the
  pattern.
- Deterministic tests beat random ones: inject seeded RNG where the engine
  allows it.

## Game data conventions

- Item ids are frozen once merged; renaming breaks saves and tests.
- Every obtainable item needs a source: a shop stock list, a recipe output, or
  enemy loot. The source-audit test enforces this.
- Story flags are written with strict `=== true` semantics; read them with a
  `story?.flags || {}` guard.
- State must stay JSON-serializable and save-compatible; bump the save version
  only for real schema changes.
