# Draft PR Notes

Fixes #132

## Summary

- Change the built-in `issue-scope-create` default `OUTPUT_DIR` to `docs/issues/scope-create/{{TASK_ID}}`.
- Document the task-specific default report artifact location and explicit override escape hatch.
- Add focused coverage for built-in workflow loading, resolved default artifact paths, and explicit override precedence.

## Changed Files

- `src/preset/assets/workflows/issue-scope-create/workflow.yaml`
- `docs/workflows/issue-scope-create.md`
- `tests/integration/workflow-loader.test.ts`
- `tests/unit/variable-resolver.test.ts`

## Tests Run

- `pnpm test -- tests/integration/workflow-loader.test.ts tests/unit/variable-resolver.test.ts`
- `pnpm build`

## PlaySpec Task

- `issue_132_unique_issue_scope_create_report_paths`

## Risk Notes

- Automation that reads `docs/issues/scope-create/*.md` directly should pass explicit path variables to keep a stable shared location.
- Installed project/user workflow copies are intentionally unchanged because registry source priority remains unchanged.
