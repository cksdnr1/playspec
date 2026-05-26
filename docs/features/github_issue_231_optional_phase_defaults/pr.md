Fixes #231

## Summary

- Stops explicitly optional phase-local variables from being demanded solely because they are declared under the active phase.
- Preserves strict default resolution for variables demanded by `required: true`, `requiredVariables`, and `outputs`.
- Adds focused resolver tests for optional phase default deferral and demanded phase default failures.

## Why This PR

Issue #231 reported that `VariableResolver` throws `UnknownVariableDefaultError` for an optional phase-local helper variable whose default references a missing dependency, even when that helper is not required, not an output, and not otherwise used by the active phase. That makes `required: false` less reliable for phase variables than for workflow-level variables.

## Problem

`getDemandedVariableNames()` added every key from `definition.variables` to the demanded set. `resolveDeclaredDefaults()` then rethrew unknown default dependency errors for those variables, so an unused optional phase helper default could fail resolution before prompt rendering.

## How It Was Fixed

- `src/template/variable-resolver.ts`
  - Updated `getDemandedVariableNames()` so active phase declarations are only demanded by declaration presence when the merged declaration is not explicitly `required: false`.
  - Left `requiredVariables` and `outputs` as explicit demand sources.
  - Left circular default detection, task override behavior, empty task variable default behavior, and unknown default suppression behavior otherwise unchanged.
- `tests/unit/variable-resolver.test.ts`
  - Added coverage for an unused optional phase default with an unavailable dependency.
  - Added coverage proving `requiredVariables` and `outputs` still demand optional phase defaults and throw `UnknownVariableDefaultError`.

## Changed Files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/github_issue_231_optional_phase_defaults/spec.md`
- `docs/features/github_issue_231_optional_phase_defaults/plan.md`
- `docs/features/github_issue_231_optional_phase_defaults/result.md`
- `docs/features/github_issue_231_optional_phase_defaults/pr.md`

## Validation

- `pnpm vitest run tests/unit/variable-resolver.test.ts` - passed, 25 tests.
- `pnpm test` - passed, 29 test files and 584 tests.
- `pnpm build` - passed.

Skipped checks: none.

## PlaySpec Task

- `github_issue_231_optional_phase_defaults`

## Risks / Follow-Ups

- This intentionally does not add template placeholder discovery. A template-rendered optional phase variable should still be declared in phase metadata such as `requiredVariables` or `outputs` when its default must be treated as demanded.
- Reusable agent guidance: no new guidance needed; this was a narrow resolver bug fix.
