# PR Preparation

## Summary

- Added user docs for validation feedback threads, approval versus feedback thresholds, workflow target source locations, read-only target strategy, compact history, prompt snapshot hashes, and manual proposal readiness.
- Added focused regression assertions for raw audit observations, threshold separation, mono-spec preset feedback config, and completion feedback non-mutation/no-proposal behavior.
- Preserved Phase 8 scope: no runtime behavior changes were intentionally introduced.

## Changed Files

- `README.md`
- `docs/evolution-feedback.md`
- `docs/workflows/feedback-config.md`
- `docs/features/phase_validation_feedback_to_prompt_evolution_signals_phase_8_tests_and_docs/spec.md`
- `docs/features/phase_validation_feedback_to_prompt_evolution_signals_phase_8_tests_and_docs/spec_validation.md`
- `docs/features/phase_validation_feedback_to_prompt_evolution_signals_phase_8_tests_and_docs/plan.md`
- `docs/features/phase_validation_feedback_to_prompt_evolution_signals_phase_8_tests_and_docs/plan_validation.md`
- `docs/features/phase_validation_feedback_to_prompt_evolution_signals_phase_8_tests_and_docs/result.md`
- `docs/features/phase_validation_feedback_to_prompt_evolution_signals_phase_8_tests_and_docs/pr.md`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/evolution-feedback-thread-store.test.ts`
- `tests/integration/validation-feedback-extractor.test.ts`
- `tests/integration/workflow-loader.test.ts`

## Tests Run

- `pnpm test tests/integration/workflow-loader.test.ts tests/integration/evolution-feedback-thread-store.test.ts tests/integration/validation-feedback-extractor.test.ts tests/integration/evolution-feedback-thread-updater.test.ts tests/integration/feedback-workflow-source-resolver.test.ts tests/integration/completion-engine.test.ts`
- `pnpm build`
- `git diff --check`
- `pnpm test`
- `pnpm test tests/integration/workflow-loader.test.ts tests/integration/evolution-feedback-thread-store.test.ts tests/integration/validation-feedback-extractor.test.ts tests/integration/completion-engine.test.ts`

## Risk Notes

- This PR is stacked on `agent/issue-201-phase-validation-feedback`.
- Documentation now describes the intended manual workflow for read-only bundled/external targets; no new workflow copy/export command is introduced.
