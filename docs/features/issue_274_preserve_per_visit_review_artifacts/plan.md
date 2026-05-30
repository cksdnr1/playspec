# Implementation Plan

## Ordered Steps

1. Update review artifact naming in `src/core/playspec-core.ts`.
   - Change the `writeReview()` helper to accept an optional completion suffix.
   - Build review paths as `reviews/phase${phaseId}${suffix}_review.yaml`.
   - Pass `completionArtifactSuffix` from `completePhase()` into `writeReview()`.
   - Preserve existing behavior because non-routed completions and first routed visits use an empty suffix.

2. Add routed regression coverage in `tests/integration/routing.test.ts`.
   - Complete the routed `validation` phase once with `{ result: 'needs_patch', withReview: true }`.
   - Capture the first result review path and first review file contents.
   - Move the task back to `validation` through the existing loop path or direct current phase update used by nearby tests.
   - Complete the second `validation` visit with `{ result: 'approved', withReview: true }`.
   - Assert first and second review paths are distinct:
     - `reviews/phasevalidation_review.yaml`
     - `reviews/phasevalidation_visit2_review.yaml`
   - Assert both files exist and the first file contents remain unchanged after the second completion.

3. Assert propagation surfaces.
   - `CompletionResult.reviewFile` for each completion.
   - `phaseHistory` entries for visit 1 and visit 2.
   - completion ledger `events[*].reviewFile`.
   - completion markdown files reference the matching review path for each event.

4. Run focused validation first, then full validation.
   - `pnpm test -- tests/integration/routing.test.ts`
   - `pnpm build`
   - `pnpm test`

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/integration/routing.test.ts`
- `docs/features/issue_274_preserve_per_visit_review_artifacts/result.md`
- `docs/features/issue_274_preserve_per_visit_review_artifacts/pr.md`

## Tests To Add Or Update

- Add one focused integration regression under the existing visit counting/routing coverage.
- Keep existing completion engine tests unchanged as compatibility coverage for `reviews/phase1_review.yaml`.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path for first visit remains `reviews/phase${phaseId}_review.yaml`.
- New path for later routed visits follows the existing snapshot/evidence suffix pattern.
- No migration is needed because historical entries already point to historical paths; the fix only prevents future overwrites.
- Manual snapshot/evidence helper paths are unrelated and should not be changed.

## Risks

- Feedback extraction depends on `reviewFile`; mitigation is to preserve the returned path contract and only change the path string before all downstream propagation.
- Completion markdown uses ledger event data; mitigation is to assert both markdown files contain their matching review paths.

## Rollback Notes

Rollback is a single core helper signature/path-format change plus one integration test. Reverting restores the old overwrite behavior but does not require data migration.

## Completion Criteria

- Repeated routed review-enabled completions produce distinct review files.
- First review content is unchanged after the second completion.
- Completion result, phase history, ledger YAML, and ledger markdown all reference the exact per-visit review path.
- Existing non-routed review path compatibility remains covered by existing tests.
