# PR Notes

Fixes #198

## Summary

- Add `ValidationFeedbackExtractor` for labelled `playspecFeedback` blocks.
- Add extraction result types and zod schemas for score, thresholds, cause, prompt target, workflow source, and target metadata.
- Enforce required machine-readable feedback blocks and reject invalid scores outside `0..100`.
- Support optional low-confidence markdown fallback for compatibility phases.
- Add focused integration coverage for the extractor acceptance criteria.

## Changed Files

- `src/evolution/validation-feedback-extractor.ts`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/index.ts`
- `tests/integration/validation-feedback-extractor.test.ts`
- `docs/features/issue_198_validation_feedback_extractor/spec.md`
- `docs/features/issue_198_validation_feedback_extractor/plan.md`
- `docs/features/issue_198_validation_feedback_extractor/result.md`
- `docs/features/issue_198_validation_feedback_extractor/pr.md`

## Tests Run

- `pnpm test tests/integration/validation-feedback-extractor.test.ts`
- `pnpm build`
- `pnpm test`
- safe-refactor rerun: `pnpm test tests/integration/validation-feedback-extractor.test.ts`
- safe-refactor rerun: `pnpm build`

## PlaySpec Task

- `issue_198_validation_feedback_extractor`

## Risk Notes

- This PR targets the #197 dependency branch because #198 builds on feedback thread/source-resolution services from #197.
- The extractor is additive library functionality. Automatic completion-time feedback thread update wiring is not included in this phase.
- Reusable agent guidance: not needed; this issue is a narrow evolution extractor implementation and does not change general repo workflow rules.
