# Issue 239 implementation plan

## Goal

Make HEAD-based `playspec current-task` and deprecated `playspec current` reject completed tasks with the standard `TaskNotActiveError`, while preserving existing output for active tasks and existing missing/empty HEAD behavior.

## Changes

1. Update `src/cli/commands/current-task.ts`.
   - Import `TaskNotActiveError` from `#core/errors.js`.
   - After `resolver.resolveTask()`, throw `TaskNotActiveError` when `task.status !== 'active'`.
   - Leave all active-task output unchanged.

2. Update `src/cli/commands/current.ts`.
   - Import `TaskNotActiveError` from `#core/errors.js`.
   - Keep the deprecation warning first.
   - After `resolver.resolveTask()`, throw `TaskNotActiveError` when `task.status !== 'active'`.
   - Leave deprecated active-task output unchanged.

3. Update `tests/cli.test.ts`.
   - Add a regression test where HEAD points at a completed task and `current-task` exits with code 1, emits no stdout, and reports `Task "<id>" is not active (status: completed).`.
   - Add the same coverage for deprecated `current`, allowing the existing deprecation warning in stderr and asserting the same non-active-task error.
   - Reuse the existing `createActiveTask`, `YamlTaskStore`, and `runCli` helpers.

## Validation

Run:

- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

If the focused CLI test command is not accepted by the package script, use `pnpm exec vitest run tests/cli.test.ts` and report the substitution.

## Risk Notes

This is a narrow read-only command behavior change. The main compatibility risk is loss of completed-task inspection via current/current-task, which the issue explicitly accepts in favor of `get-task <taskId>` or archive inspection.
