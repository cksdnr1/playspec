# PR Notes

Fixes #102

## Summary

- Validate the requested workflow in `playspec create` with `WorkflowLoader.resolve()` before normal or phase-execution task creation can write state.
- Preserve existing project/user/built-in workflow precedence and default `mono-spec` behavior.
- Add regression coverage for unknown workflow rejection, HEAD preservation, missing task directory prevention, valid built-in create, and phase-execution rejection.

## Changed Files

- `src/cli/commands/create.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/validate_workflow_ids_during_task_creation/spec.md`
- `docs/features/validate_workflow_ids_during_task_creation/plan.md`
- `docs/features/validate_workflow_ids_during_task_creation/result.md`
- `docs/features/validate_workflow_ids_during_task_creation/pr.md`

## Tests Run

- `pnpm test -- tests/cli.test.ts tests/integration/init-create-next.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `validate_workflow_ids_during_task_creation`

## Risk Notes

- Direct `YamlTaskStore.createTask()` callers remain workflow-agnostic by design; this PR fixes the CLI create mutation path.
- Workflow validation now fails earlier for malformed workflow files or missing templates because it uses the same loader path as prompt rendering.

## Reusable Agent Guidance

No reusable agent guidance update is needed. The issue is a narrow CLI validation bug, and the existing repository guidance already covers workflow boundaries and path alias rules.
