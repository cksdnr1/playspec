# Preserve per-visit completion artifacts

## Problem

Repeated routed phase completions already record distinct `phaseHistory` entries with `visitCount`, but completion snapshots and evidence use filenames keyed only by `phaseId`. A second visit to the same routed phase overwrites the first visit's files while old history and completion ledger entries still point at those paths.

## Goals

- Repeated completion visits for the same routed phase must write distinct snapshot files.
- Repeated completion visits for the same routed phase must write distinct evidence files.
- `phaseHistory`, completion ledger events, returned `CompletionResult`, and `rollback.lastSafePoint` must reference the exact files written for that visit.
- Existing one-pass and first-visit filenames remain compatible.

## Non-goals

- Do not redesign routing, `maxVisits`, completion ledger storage, or prompt output paths outside completion artifacts.
- Do not change manual snapshot/evidence filenames.
- Do not change workflow artifact declarations or issue-scope report paths.

## Design

`PlaySpecCore.completePhase()` already computes routed `visitCount` before any artifact writes. Thread that value into completion artifact path selection.

Filename rule:

- Non-routed phases keep existing completion paths.
- Routed first visits (`visitCount === 1`) keep existing completion paths.
- Routed repeated visits (`visitCount > 1`) add `_visitN` before the artifact type suffix.

Examples:

- First validation visit: `snapshots/phasevalidation_before_complete.yaml`
- Second validation visit: `snapshots/phasevalidation_visit2_before_complete.yaml`
- First validation evidence: `evidence/phasevalidation_git_status.txt`
- Second validation evidence: `evidence/phasevalidation_visit2_git_status.txt`

The snapshot/evidence writer return values remain the source of truth for `phaseHistory`, rollback safe points, completion ledger events, and `CompletionResult`.

## Test Plan

- Add routing regression coverage that completes `validation` twice, verifies the two `phaseHistory` entries have different snapshot/evidence file arrays, and verifies all referenced files exist.
- Capture first-visit file contents before the second visit and assert they are unchanged after the second visit.
- Keep existing completion-engine assertions for first-visit linear artifact paths unchanged.
