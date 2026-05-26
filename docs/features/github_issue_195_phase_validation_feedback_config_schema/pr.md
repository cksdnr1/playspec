# PR Draft

Fixes #195

## Summary

- Added optional typed `feedback` config to workflow phase definitions for prompt-evolution signals.
- Added loader validation that feedback source, evaluated artifact, and evolution target phase IDs reference existing workflow phases.
- Added workflow-loader integration coverage for valid config, backward compatibility, invalid policy values, invalid path/source kinds, invalid compact history/readiness policy, and missing phase references.

## Changed Files

- `src/core/schemas.ts`
- `src/core/types.ts`
- `src/workflow/workflow-loader.ts`
- `tests/integration/workflow-loader.test.ts`
- `docs/features/github_issue_195_phase_validation_feedback_config_schema/spec.md`
- `docs/features/github_issue_195_phase_validation_feedback_config_schema/plan.md`
- `docs/features/github_issue_195_phase_validation_feedback_config_schema/result.md`
- `docs/features/github_issue_195_phase_validation_feedback_config_schema/pr.md`

## Tests Run

- `pnpm test tests/integration/workflow-loader.test.ts`
- `pnpm build`
- `pnpm test`
- `pnpm test tests/integration/workflow-loader.test.ts` after safe refactor cleanup

## PlaySpec Task

- `github_issue_195_phase_validation_feedback_config_schema`

## Risk Notes

- No score parsing, feedback capture, evolution writes, or workflow opt-ins are included in this phase.
- Target file path existence and writability are intentionally deferred to later capture/proposal phases.

## Reusable Agent Guidance

No reusable agent guidance change is needed. This is a narrow schema/type/loader validation addition.
