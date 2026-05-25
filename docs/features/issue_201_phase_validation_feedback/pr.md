# PR Notes

Fixes #201

## Summary

- Opts `mono-spec` technical spec and implementation plan validation phases into prompt-evolution feedback capture.
- Keeps approval threshold at 95 while recording feedback signals at threshold 90.
- Adds required `playspecFeedback` metadata guidance to both validation templates.
- Allows validator prompt gaps to target the active validation prompt instead of the default authoring prompt.
- Adds loader and completion-engine regression coverage for config loading, 91/89 score behavior, routing, and target selection.

## Changed Files

- `src/core/playspec-core.ts`
- `src/evolution/feedback-thread-updater.ts`
- `src/evolution/types.ts`
- `src/evolution/validation-feedback-extractor.ts`
- `src/preset/assets/workflows/mono-spec/workflow.yaml`
- `src/preset/assets/workflows/mono-spec/templates/tech_spec_validate.md`
- `src/preset/assets/workflows/mono-spec/templates/implementation_plan_validate.md`
- `tests/integration/workflow-loader.test.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_201_phase_validation_feedback/spec.md`
- `docs/features/issue_201_phase_validation_feedback/plan.md`
- `docs/features/issue_201_phase_validation_feedback/result.md`
- `docs/features/issue_201_phase_validation_feedback/pr.md`

## Tests Run

- `pnpm test tests/integration/workflow-loader.test.ts tests/integration/completion-engine.test.ts`
- `pnpm build`
- `git diff --check`
- `pnpm test`
- Safe-refactor rerun: `pnpm test tests/integration/workflow-loader.test.ts tests/integration/completion-engine.test.ts`

## PlaySpec Task

- `issue_201_phase_validation_feedback`

## Risk Notes

- This PR is stacked on `agent/issue-200-thread-evidence` because #201 depends on #200.
- Feedback capture still depends on validation output being present in the configured score artifact; this PR does not redesign validation response persistence.
- Bundled mono-spec prompt targets are marked non-writable, so proposal mutation remains manual-review driven.

## Reusable Agent Guidance

No AGENTS.md update is needed. The existing repository guidance already covers workflow boundaries, MCP boundaries, and non-destructive operation.
