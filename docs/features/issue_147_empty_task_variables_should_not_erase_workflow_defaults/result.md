# Issue 147 Result

## Behavior Implemented

`VariableResolver.resolve()` now preserves resolved workflow or phase declaration defaults when the corresponding task variable is stored as an empty string. Non-empty task variables still override resolved defaults.

The fix is limited to the final variable merge:

- Engine variables remain the base.
- Declaration defaults remain the resolved fallback layer.
- Only non-empty task variables are applied as the final override layer.

Required-variable validation was not changed.

## Files Changed

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/spec.md`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/plan.md`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/result.md`

## Verification

Targeted regression command:

```sh
pnpm exec vitest run tests/unit/variable-resolver.test.ts tests/integration/init-create-next.test.ts
```

Result: passed, 62 tests.

Full validation commands:

```sh
pnpm build
pnpm test
```

Results:

- `pnpm build`: passed.
- `pnpm test`: passed, 485 tests.

No validation commands were skipped.

## Remaining Risks

Callers that intentionally used `NAME=""` to blank an optional default will now receive the declaration default when one exists. This matches the resolver's existing internal treatment of empty task variables as unresolved during default resolution.

## Safe Refactor Review

Reviewed the scoped diff for cleanup opportunities after implementation. No refactor was applied because the resolver change is already a local three-line overlay and the tests follow nearby existing patterns.

Verification during this phase:

```sh
git diff --check
```

Result: passed.

## PR Preparation

Reusable agent guidance: no update needed. The work is a localized resolver precedence fix and does not establish a reusable repository workflow rule beyond the existing test expectations.

Draft PR body written to `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/pr.md`.

Draft PR created: https://github.com/cksdnr1/playspec/pull/166
