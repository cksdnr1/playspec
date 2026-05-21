# Issue 132 Implementation Plan

## Ordered Steps

1. Update `src/preset/assets/workflows/issue-scope-create/workflow.yaml`.
   - Change `OUTPUT_DIR.default` from `docs/issues/scope-create/{{ISSUE_SCOPE}}` to `docs/issues/scope-create/{{TASK_ID}}`.
   - Keep `DISCOVERY_FILE`, `CANDIDATE_ISSUES_FILE`, and `CREATED_ISSUES_FILE` derived from `{{OUTPUT_DIR}}`.
   - Update the `OUTPUT_DIR` description to mention the task-specific default and explicit override support.

2. Update `docs/workflows/issue-scope-create.md`.
   - Add a short report artifacts section.
   - Document the default paths:
     - `docs/issues/scope-create/{{TASK_ID}}/discovery.md`
     - `docs/issues/scope-create/{{TASK_ID}}/candidate_issues.md`
     - `docs/issues/scope-create/{{TASK_ID}}/created_issues.md`
   - State that callers can pass `OUTPUT_DIR` or individual file variables for stable shared paths.

3. Update `tests/integration/workflow-loader.test.ts`.
   - Extend the existing `issue-scope-create` loader test to assert `OUTPUT_DIR.default` includes `{{TASK_ID}}`.
   - Assert the default is not the bare shared directory.

4. Update `tests/unit/variable-resolver.test.ts`.
   - Add a focused workflow fixture for `issue-scope-create`.
   - Add a default resolution test proving a task resolves artifact paths below `docs/issues/scope-create/<task-id>`.
   - Add an override test proving explicit `OUTPUT_DIR`, `DISCOVERY_FILE`, `CANDIDATE_ISSUES_FILE`, and `CREATED_ISSUES_FILE` values are preserved exactly.

5. Run focused validation.
   - `pnpm test -- tests/integration/workflow-loader.test.ts tests/unit/variable-resolver.test.ts`
   - `pnpm build`
   - Run broader tests only if the focused tests expose shared behavior changes.

## Active Entry Point Trace

- Entry: `playspec create ... --workflow issue-scope-create`.
- State/data: task variables are persisted by `YamlTaskStore`.
- Propagation: `VariableResolver.resolve()` combines engine variables, workflow defaults, and task variables.
- User-visible behavior: prompts/templates receive artifact paths under the task-specific default output directory.
- Bypass path: explicit task variables override workflow defaults and remain the documented way to keep stable shared report paths.

## Old Paths, Bypasses, Partial Migration Risks

- Old default path: `docs/issues/scope-create/{{ISSUE_SCOPE}}`.
- New default path: `docs/issues/scope-create/{{TASK_ID}}`.
- Compatibility bypass: callers can set `OUTPUT_DIR=docs/issues/scope-create` or set individual file variables.
- Partial migration risk: installed project/user copies of the workflow will not be changed by editing the built-in asset. Existing registry priority remains unchanged by design.

## Tests

- Integration: built-in workflow loads with task-specific `OUTPUT_DIR` default and unchanged artifact indirection.
- Unit: resolver produces default artifact paths from `TASK_ID`.
- Unit: resolver preserves explicit path overrides.

## Rollback Notes

Rollback is limited to reverting the workflow YAML default, documentation paragraph, and added test assertions. No persisted task schema or migration is involved.

## Completion Criteria

- Built-in default artifact paths include a task-specific segment.
- All explicit artifact path overrides continue to resolve as supplied.
- Documentation reflects the new default and override escape hatch.
- Focused tests and build pass.
