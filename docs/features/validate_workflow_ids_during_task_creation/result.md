# Validate Workflow IDs During Task Creation Result

## Files Changed

- `src/cli/commands/create.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/validate_workflow_ids_during_task_creation/spec.md`
- `docs/features/validate_workflow_ids_during_task_creation/plan.md`
- `docs/features/validate_workflow_ids_during_task_creation/result.md`

## Behavior Implemented

- `runCreate()` now validates the requested workflow through `WorkflowLoader.resolve()` immediately after confirming the workspace is initialized.
- Unknown workflow IDs now fail before normal task creation can write task YAML, source files, or `.playspec/HEAD`.
- Unknown workflow IDs now fail before phase-execution task creation can resolve planning context or write execution task state.
- Existing workflow resolution precedence is preserved because validation uses the same loader/registry path as prompt rendering.
- Title-only create still uses the existing `mono-spec` default from the CLI option.

## Verification Performed

- `pnpm test -- tests/cli.test.ts tests/integration/init-create-next.test.ts`
  - Passed: 2 test files, 191 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 24 test files, 416 tests.

## Remaining Risks

- `YamlTaskStore.createTask()` remains intentionally workflow-agnostic. Direct storage callers can still persist arbitrary workflow strings; this fix targets the CLI create mutation path from the issue.
- `WorkflowNotFoundError` retains the existing hint text, including workflow list/install wording. Tests assert stable guidance substrings rather than exact formatting.

## Safe Refactor Review

- Compared the branch diff against `origin/master`.
- No additional refactor was applied. The implementation is already limited to one CLI helper/call site plus focused regression tests.
- Intentionally skipped broader helper extraction in tests to keep the change scoped and avoid unrelated test rewrites.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/107
- Branch: `agent/issue-102-validate-workflow`
- Reusable agent guidance: no update needed; existing repository guidance already covers the relevant workflow and module-boundary rules.
