# Issue 194 Implementation Result

## Behavior Implemented

- Added effective variable declaration merging by field.
- Workflow-level declaration metadata is preserved when a phase same-name declaration only supplies partial metadata.
- Phase-level `default` and `description` still override workflow-level fields for the active phase.
- Explicit phase-level `required: false` is now the covered contract for relaxing workflow-level `required: true`.
- Prompt render required-variable validation and CLI create initial-phase validation use the same effective declaration map as default resolution.

## Changed Files

- `src/template/variable-resolver.ts`
  - Added `mergeVariableDeclarations()`.
  - Replaced whole-object workflow/phase declaration spread with per-variable merge.
  - Based demanded declaration required checks on the merged map.

- `src/core/required-variables.ts`
  - Changed required validation to consume an effective declaration map.

- `src/core/playspec-core.ts`
  - Uses merged declarations before asserting required variables during prompt rendering and next-phase validation.

- `src/cli/commands/create.ts`
  - Uses merged declarations for non-interactive initial required-variable validation.

- `tests/unit/variable-resolver.test.ts`
  - Added regression coverage for same-name workflow/phase metadata merging and phase default override.

- `tests/integration/init-create-next.test.ts`
  - Added render-path coverage for preserving workflow required metadata when a phase only changes description.
  - Added coverage for phase default override without restating `required`.
  - Added coverage for explicit phase `required: false` relaxation.

## Verification Performed

- `git diff --check`
  - Passed.

- `pnpm exec vitest run tests/unit/variable-resolver.test.ts`
  - Passed: 22 tests.

- `pnpm exec vitest run tests/integration/init-create-next.test.ts -t "required|Phase"`
  - Passed: 10 selected tests, 43 skipped.

- `pnpm build`
  - Passed.

- `pnpm test`
  - Passed: 24 test files, 511 tests.

## Remaining Risks

- Workflows that accidentally relied on phase declarations replacing workflow-level `required: true` now need an explicit `required: false` phase declaration.
- `definition.requiredVariables` still remains mandatory regardless of declaration metadata; this is unchanged and intentional.

## Safe Refactor Review

- Reviewed `assertRequiredVariables()` call sites and found both active paths updated:
  - `PlaySpecCore.resolveAndAssertRequiredVariables()`
  - CLI create initial required-variable validation
- Searched for stale workflow/phase variable spread patterns in `src` and `tests`; none remained for this behavior.
- No additional refactor was applied because the implementation diff is already minimal and scoped to the planned files.

## PR Notes

- Draft PR: https://github.com/cksdnr1/playspec/pull/203
- Branch: `agent/issue-194-preserve-variable-required`
- Reusable agent guidance: not needed; this is a localized runtime/test fix.
