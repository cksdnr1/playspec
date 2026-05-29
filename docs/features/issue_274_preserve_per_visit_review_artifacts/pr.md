Fixes #274

## Summary

- Preserves review artifacts for repeated routed phase completions by applying the existing visit suffix to review filenames.
- Keeps first-visit and non-routed review filenames compatible, including `reviews/phase1_review.yaml` and `reviews/phasevalidation_review.yaml`.
- Adds routed integration coverage proving visit 1 and visit 2 review files, phase history, ledger YAML, and completion markdown all reference the correct per-visit path.

## Why this PR

Repeated routed completions already write visit-specific snapshots and evidence, but review artifacts reused `reviews/phase${phaseId}_review.yaml` for every visit. That allowed a later routed visit to overwrite an earlier review while persisted history and completion ledger entries still pointed at the same path.

## Problem

For review-enabled routed workflows, completion records could become misleading: visit 1 history, ledger YAML, markdown, and feedback inputs could reference a review file whose contents were produced by visit 2.

## How it was fixed

- `src/core/playspec-core.ts`: `completePhase()` now passes the existing `completionArtifactSuffix` into `writeReview()`.
- `src/core/playspec-core.ts`: `writeReview()` now writes `reviews/phase${phaseId}${completionSuffix}_review.yaml`, preserving the empty-suffix first-visit path and producing `_visit2` paths for repeated routed visits.
- `tests/integration/routing.test.ts`: expanded the repeated visit regression to run with `withReview: true` and assert returned paths, phase history paths, file existence, unchanged first review contents, ledger events, and completion markdown references.

## Validation

- `pnpm test -- tests/integration/routing.test.ts`: passed, 25 tests.
- `pnpm build`: passed.
- `pnpm test`: passed, 32 test files / 647 tests.

Skipped checks: none.

## Changed files

- `src/core/playspec-core.ts`
- `tests/integration/routing.test.ts`
- `docs/features/issue_274_preserve_per_visit_review_artifacts/spec.md`
- `docs/features/issue_274_preserve_per_visit_review_artifacts/plan.md`
- `docs/features/issue_274_preserve_per_visit_review_artifacts/result.md`
- `docs/features/issue_274_preserve_per_visit_review_artifacts/pr.md`

## PlaySpec task id

`issue_274_preserve_per_visit_review_artifacts`

## Risks / follow-ups

No known follow-up. Historical entries are not migrated; the change prevents future routed review overwrites while preserving existing first-visit paths.
