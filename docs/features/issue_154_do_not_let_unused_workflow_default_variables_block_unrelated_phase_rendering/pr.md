Fixes #154

## Summary

- Defer `UnknownVariableDefaultError` for workflow defaults that are not demanded by the active phase.
- Keep demanded defaults strict by deriving demand from workflow-required variables, phase variables, `requiredVariables`, and phase `outputs`.
- Add resolver unit coverage for an unused future-phase default with an unavailable dependency.

## Changed Files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_154_do_not_let_unused_workflow_default_variables_block_unrelated_phase_rendering/spec.md`
- `docs/features/issue_154_do_not_let_unused_workflow_default_variables_block_unrelated_phase_rendering/plan.md`
- `docs/features/issue_154_do_not_let_unused_workflow_default_variables_block_unrelated_phase_rendering/result.md`
- `docs/features/issue_154_do_not_let_unused_workflow_default_variables_block_unrelated_phase_rendering/pr.md`

## Tests Run

- `pnpm test -- tests/unit/variable-resolver.test.ts`
- `pnpm test`
- `pnpm build`

## PlaySpec Task ID

`issue_154_do_not_let_unused_workflow_default_variables_block_unrelated_phase_rendering`

## Risk Notes

- No `PlaySpecCore` behavior change was needed; active template placeholders not represented in resolver demand remain covered by existing template unresolved-placeholder validation.
- Workflow-level `required: true` behavior remains unchanged and global.
