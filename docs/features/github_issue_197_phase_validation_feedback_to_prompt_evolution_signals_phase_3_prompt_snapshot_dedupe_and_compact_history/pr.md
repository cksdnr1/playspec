# PR Notes

Fixes #197

Draft PR: https://github.com/cksdnr1/playspec/pull/206

## Summary

- Added Phase 3 feedback evolution library entry points for rendered prompt snapshot hashing, workflow source resolution, and semantic feedback thread updates.
- Extended feedback thread persistence contracts with prompt snapshots, hash-free dedupe keys, dedupe hashes, and compact overflow summaries.
- Added integration coverage for project/user/bundled/external source metadata, repeated semantic dedupe, prompt hash history, compact history retention, and manual-only readiness.

## Changed Files

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/feedback-workflow-source-resolver.ts`
- `src/evolution/prompt-snapshot-hasher.ts`
- `src/evolution/feedback-thread-updater.ts`
- `src/evolution/index.ts`
- `tests/integration/evolution-feedback-thread-store.test.ts`
- `tests/integration/evolution-feedback-thread-updater.test.ts`
- `tests/integration/feedback-workflow-source-resolver.test.ts`
- `docs/features/github_issue_197_phase_validation_feedback_to_prompt_evolution_signals_phase_3_prompt_snapshot_dedupe_and_compact_history/spec.md`
- `docs/features/github_issue_197_phase_validation_feedback_to_prompt_evolution_signals_phase_3_prompt_snapshot_dedupe_and_compact_history/plan.md`
- `docs/features/github_issue_197_phase_validation_feedback_to_prompt_evolution_signals_phase_3_prompt_snapshot_dedupe_and_compact_history/result.md`
- `docs/features/github_issue_197_phase_validation_feedback_to_prompt_evolution_signals_phase_3_prompt_snapshot_dedupe_and_compact_history/pr.md`

## Tests Run

- `pnpm test tests/integration/feedback-workflow-source-resolver.test.ts tests/integration/evolution-feedback-thread-updater.test.ts tests/integration/evolution-feedback-thread-store.test.ts`
- `pnpm build`
- `pnpm test`
- Safe-refactor rerun: `pnpm test tests/integration/feedback-workflow-source-resolver.test.ts tests/integration/evolution-feedback-thread-updater.test.ts tests/integration/evolution-feedback-thread-store.test.ts`
- Safe-refactor rerun: `pnpm build`
- Final: `pnpm build`
- Final: `pnpm test`

## PlaySpec Task

`github_issue_197_phase_validation_feedback_to_prompt_evolution_signals_phase_3_prompt_snapshot_dedupe_and_compact_history`

## Risk Notes

- This phase adds library entry points and persistence contracts only; it does not wire automatic feedback capture into phase completion.
- External workflow roots are treated as non-writable by default.
- Reusable agent guidance: no new standing AGENTS.md guidance is needed; the existing phase-boundary and no-auto-apply rules already cover this work.
