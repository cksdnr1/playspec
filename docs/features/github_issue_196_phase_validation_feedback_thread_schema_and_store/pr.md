# PR Notes

Fixes #196

## Summary

- Added canonical feedback thread schemas/types for prompt evolution signals.
- Added `EvolutionFeedbackThreadStore` for workspace-local YAML persistence under `.playspec/evolution/feedback`.
- Added explicit raw observation persistence that is only invoked through `saveRawObservation()`.
- Added focused integration coverage for write/reload, upsert, metadata preservation, path locality, separate approval/feedback results, and default absence of raw observation files.

## Changed Files

- `src/evolution/schemas.ts`
- `src/evolution/types.ts`
- `src/evolution/feedback-thread-store.ts`
- `src/utils/paths.ts`
- `tests/integration/evolution-feedback-thread-store.test.ts`
- `docs/features/github_issue_196_phase_validation_feedback_thread_schema_and_store/spec.md`
- `docs/features/github_issue_196_phase_validation_feedback_thread_schema_and_store/plan.md`
- `docs/features/github_issue_196_phase_validation_feedback_thread_schema_and_store/result.md`
- `docs/features/github_issue_196_phase_validation_feedback_thread_schema_and_store/pr.md`

## Tests Run

- `pnpm test tests/integration/evolution-feedback-thread-store.test.ts`
- `pnpm build`
- `pnpm test`
- Safe-refactor focused rerun: `pnpm test tests/integration/evolution-feedback-thread-store.test.ts`
- Final pre-commit validation: `pnpm build`
- Final pre-commit validation: `pnpm test`

## PlaySpec Task

- `github_issue_196_phase_validation_feedback_thread_schema_and_store`

## Risk Notes

- This branch depends on #195 and should target `agent/issue-195-feedback-config-schema` until that work is merged.
- No proposal matching, prompt surfacing, phase completion capture, CLI, or MCP write path is added in this phase.
- Raw observation writes are explicit only. Canonical thread save/upsert does not create observation files by default.
- Reusable agent guidance: no new guidance needed. This change follows existing evolution store patterns.
