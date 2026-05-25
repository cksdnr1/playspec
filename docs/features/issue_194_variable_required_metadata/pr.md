# Draft PR: Preserve Variable Required Metadata Across Phase Overrides

Fixes #194

## Summary

- Added shared per-variable declaration merging for workflow and phase variables.
- Wired resolver defaults, core prompt rendering, and CLI create validation to the same effective declaration map.
- Added regression coverage for required metadata preservation, phase default override behavior, and explicit phase `required: false` relaxation.

## Changed Files

- `src/template/variable-resolver.ts`
- `src/core/required-variables.ts`
- `src/core/playspec-core.ts`
- `src/cli/commands/create.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_194_variable_required_metadata/spec.md`
- `docs/features/issue_194_variable_required_metadata/plan.md`
- `docs/features/issue_194_variable_required_metadata/result.md`

## Tests Run

- `pnpm exec vitest run tests/unit/variable-resolver.test.ts`
- `pnpm exec vitest run tests/integration/init-create-next.test.ts -t "required|Phase"`
- `git diff --check`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_194_preserve_workflow_variable_required_metadata`

## Risk Notes

- Workflows that relied on accidental whole-object replacement to relax workflow-level `required: true` must now use an explicit phase-level `required: false`.
- `definition.requiredVariables` remains mandatory regardless of declaration metadata; unchanged behavior.

## Reusable Agent Guidance

No reusable agent guidance is needed. The change is a localized runtime/test fix for declaration merge semantics.
