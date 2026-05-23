# Draft PR Body

Fixes #147

## Summary

- Preserve resolved workflow/phase declaration defaults when the same task variable is stored as an empty string.
- Keep non-empty task variables as explicit overrides.
- Add resolver-level and render-path regression coverage for required default-backed variables with empty task values.

## Changed Files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/spec.md`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/plan.md`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/result.md`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/pr.md`

## Tests Run

- `pnpm exec vitest run tests/unit/variable-resolver.test.ts tests/integration/init-create-next.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

`issue_147_empty_task_variables_should_not_erase_workflow_defaults`

## Risk Notes

- Callers that intentionally used `NAME=""` to blank an optional default will now receive the declaration default when one exists. This aligns the final variable map with the resolver's existing treatment of empty task variables as unresolved during default resolution.

## Reusable Agent Guidance

No reusable guidance update is needed. This is a localized resolver precedence bug with focused regression coverage.
