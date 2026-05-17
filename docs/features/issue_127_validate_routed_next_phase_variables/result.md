# Implementation result

## Behavior implemented

- `PlaySpecCore.completePhase()` now validates the computed next phase's required variables before rendering the current completion snapshot or entering the write lock.
- The preflight uses the same `VariableResolver` and `assertRequiredVariables()` path used by prompt rendering.
- When the computed next phase is `null`, completion skips the preflight as before.
- Missing routed target variables now surface as `MissingRequiredVariablesError` before task state or completion artifacts are updated.

## Files changed

- `src/core/playspec-core.ts`
- `tests/integration/routing.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_127_validate_routed_next_phase_variables/spec.md`
- `docs/features/issue_127_validate_routed_next_phase_variables/plan.md`
- `docs/features/issue_127_validate_routed_next_phase_variables/result.md`

## Verification performed

- `pnpm vitest run tests/integration/routing.test.ts tests/cli.test.ts`
  - Result: passed, 193 tests.
- `pnpm test`
  - Result: passed, 24 test files and 451 tests.
- `pnpm build`
  - Result: passed.

## Safe refactor review

- Reviewed the diff against `origin/master`.
- No behavior-preserving code cleanup was warranted; the implementation is already localized to the core helper/preflight and regression tests.
- Intentionally skipped unrelated formatting or fixture consolidation to avoid churn in the CLI test file.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/128
- Branch: `agent/issue-127-routed-next-vars`
- Reusable agent guidance: no new guidance needed; this is a localized core validation fix.

## Remaining risks

- No known remaining implementation risks.
