# Implementation plan

## Ordered Steps

1. Update `src/cli/commands/specs.ts`.
   - In `runSpecs`, keep `ActiveTaskResolver.resolveTask(opts.task)` unchanged.
   - Replace the conditional HEAD-only guard with an unconditional `task.status !== 'active'` guard.
   - Continue throwing `TaskNotActiveError(task.id, task.status)` so the existing error text and recovery hint are preserved.
   - Do not alter workflow loading, phase resolution, relevant-file discovery, missing warnings, output modes, or file reading behavior.

2. Add focused CLI regression coverage in `tests/cli.test.ts`.
   - Place the test beside the existing `specs` command tests.
   - Create an active mono-spec task and write a relevant file under `docs/features/<taskId>/spec.md`.
   - Mark the task `completed` using `YamlTaskStore.updateTask`.
   - Run `specs --task <taskId> --path-only` with `PLAY_SPEC_NON_INTERACTIVE=1`.
   - Assert a non-zero exit, stderr contains `Task "<taskId>" is not active`, and stdout does not include the relevant file path.

3. Validate behavior.
   - Run the focused `specs` CLI tests first.
   - Run the full repository validation expected for this repo: `pnpm build` and `pnpm test`.

## Files To Edit

- `src/cli/commands/specs.ts`
- `tests/cli.test.ts`

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: HEAD-based `specs --path-only` already rejects completed HEAD tasks.
- Bypass path: explicit `specs --task <completedTaskId>` currently skips the guard and reaches discovery/output handling.
- Partial migration risk: adding a guard in a lower-level resolver would affect other commands out of scope. The guard belongs in `specs` to keep behavior limited to this command.

## Tests To Add Or Update

- Add one regression test for `specs --task <completedTaskId> --path-only`.
- Keep the existing active explicit-task test passing so `--task <activeTaskId>` still works and does not change HEAD.
- Existing `specs --print`, binary/large-file, missing-path, and interactive selection tests should remain unchanged.

## Risks

- The new guard intentionally removes the accidental ability to inspect completed tasks through `specs --task`.
- The issue title conflicts with the issue body. Implementation follows the detailed body, acceptance criteria, and test requirements.

## Rollback Notes

- Reverting the single guard change restores the previous explicit-task bypass.
- Reverting the regression test removes only the new completed-task assertion.

## Completion Criteria

- `specs --task <completedTaskId> --path-only` exits non-zero before printing relevant file paths.
- The error uses `TaskNotActiveError` and includes the active-task recovery hint.
- `specs --task <activeTaskId> --path-only` still succeeds without changing HEAD.
- Focused and full validation commands pass.
