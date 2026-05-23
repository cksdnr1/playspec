# Implementation Plan

## Ordered Steps

1. Update the prompt command lifecycle guard.
   - File: `src/cli/commands/prompt.ts`
   - Change the resolved-task check from HEAD-only to all resolved tasks.
   - Expected behavior: `prompt --task <completedTaskId>` throws `TaskNotActiveError` before context header, desync checks, rendering, copying, or output writes.

2. Update the deprecated next command lifecycle guard.
   - File: `src/cli/commands/next.ts`
   - Apply the same all-resolved-task guard.
   - Preserve the existing deprecation warning because it is emitted before command work today.

3. Strengthen CLI regression coverage.
   - File: `tests/cli.test.ts`
   - Update explicit completed prompt coverage to use `--print-only --quiet` and assert `TaskNotActiveError` wording with task ID/status.
   - Add an explicit completed prompt `--out <path>` test that asserts non-zero exit and the output file does not exist.
   - Keep or adjust deprecated `next --task <completedTaskId>` coverage to assert the same lifecycle error.
   - Keep active explicit prompt/next behavior covered by existing tests.

4. Run focused and full validation.
   - Inspect `package.json` scripts before validation.
   - Run focused `pnpm test -- tests/cli.test.ts`.
   - Run `pnpm build`.
   - Run full `pnpm test` if focused validation passes.

## Entry Point Trace

- User command: `playspec prompt --task <id>` or `playspec next --task <id>`.
- Resolution: `ActiveTaskResolver.resolveTask(id)` returns the stored task record.
- Validation: command checks `task.status !== 'active'` and throws `TaskNotActiveError`.
- User-visible result: non-zero CLI exit with task ID/status in stderr.
- Mutation/write behavior: no prompt rendering or output writing occurs after rejection.

## Old Paths and Bypasses

- Old bypass: explicit `--task` skipped the CLI lifecycle guard because the guard only ran when `taskIdOption` was absent.
- Remaining partial path: core render helpers still have their own active-task assertion. Keep it as defense in depth.
- Out-of-scope similar pattern: `specs --task` has a similar conditional guard but is not part of this issue.

## Risks

- Low: earlier rejection may change ordering of any future desync warning for explicit completed tasks. This is intended by the issue.
- Low: `next` still prints the deprecation warning before the lifecycle error. Preserve existing command behavior unless tests show a stronger requirement.

## Rollback Notes

Reverting the two guard changes and the added tests restores prior behavior. No storage, migration, or task schema changes are involved.

## Completion Criteria

- Completed explicit prompt tasks fail before writing `--out` artifacts.
- Completed explicit next tasks fail with the same active-task lifecycle error.
- Active explicit prompt/next behavior remains unchanged.
- Focused/full validation passes.
