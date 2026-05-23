# Issue 155 Add-Context Completed Task Guard Plan

## Ordered Implementation Steps

1. Add the shared lifecycle guard in `PlaySpecCore.addContextRef()`.
   - File: `src/core/playspec-core.ts`
   - Load the task as it does today.
   - Immediately call `this.assertTaskIsActive(task)` before duplicate detection and before `taskStore.updateTask()`.
   - Keep current path validation order and duplicate handling unchanged.

2. Add CLI preflight before `--edit` can create a note file.
   - File: `src/cli/commands/add-context.ts`
   - Import `TaskNotActiveError` from `#core/errors.js`.
   - When resolving HEAD interactively, reject a non-active task before printing confirmation prompts or entering edit flow.
   - For explicit `--task` with `--edit`, load the task before creating `.playspec/tasks/active/<taskId>/sources/context_note_*.md` and reject if it is not active.
   - Let normal explicit non-edit `--task` still hit the shared core guard so CLI and MCP share the authoritative mutation boundary.

3. Add CLI regression tests.
   - File: `tests/cli.test.ts`
   - Near existing add-context tests, create a completed task by using `YamlTaskStore.createTask()` followed by `updateTask(taskId, { status: 'completed' })`.
   - Test explicit non-interactive `add-context <path> --task <completedTaskId>`:
     - create a real context file;
     - capture task YAML before command;
     - assert exit code is non-zero;
     - assert stderr includes `is not active (status: completed)` and the existing recovery hint;
     - assert task YAML is unchanged or `contextRefs` remains empty.
   - Test `add-context --edit --task <completedTaskId>`:
     - set `EDITOR=true` or another no-op editor;
     - assert non-zero exit;
     - assert no `sources/context_note_*.md` file exists.

4. Run focused validation.
   - `pnpm test -- tests/cli.test.ts`
   - If focused tests pass, run `pnpm build`.
   - Run broader `pnpm test` only if changes or failures suggest cross-file risk.

## Files To Edit

- `src/core/playspec-core.ts`
- `src/cli/commands/add-context.ts`
- `tests/cli.test.ts`

## Tests To Add Or Update

- Add explicit completed-task add-context regression coverage.
- Add edit-note preflight regression coverage for completed tasks.
- Keep existing active-task explicit add-context test unchanged.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: CLI explicit `--task` currently reaches `PlaySpecCore.addContextRef()` with completed tasks.
- Bypass path: MCP calls `PlaySpecCore.addContextRef()` directly, so the core guard is mandatory.
- Partial migration risk: guarding only the core helper leaves `--edit` able to create orphan context note files before rejection; CLI preflight closes that path.

## Risks

- Duplicate task status checks in CLI and core are intentional. Core remains authoritative for mutation; CLI preflight prevents pre-mutation file creation.
- Path validation order in core remains unchanged to preserve existing error behavior for invalid paths.

## Rollback Notes

- Revert the two code changes and the added tests. No data migration is introduced.

## Completion Criteria

- Active explicit add-context still links a context file.
- Completed explicit add-context exits non-zero with `TaskNotActiveError` wording and no `contextRefs` mutation.
- Completed edit add-context exits before creating any `context_note_*.md`.
- Focused CLI tests pass.
