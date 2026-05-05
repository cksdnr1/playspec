# Issue 86 Implementation Plan

## Readiness

Spec validation passed at 96/100 after the test-strategy patch. No blockers remain for implementation.

## Ordered Steps

1. Update `src/cli/commands/list-tasks.ts`.
   - Add a local `orderTasksForDisplay(tasks, headTaskId)` helper over `TaskSummary[]`.
   - If HEAD is `null` or does not match an active task, return `tasks` unchanged.
   - If HEAD matches, return `[headTask, ...tasksWithoutHead]`.
   - Keep existing output header, effective phase display, and ` [HEAD]` marker.
   - Do not change `YamlTaskStore`, task schemas, workflow loading, MCP, or Commander options.

2. Update `tests/cli.test.ts`.
   - Add a small row parser for `list-tasks` output if useful.
   - Add a real CLI test for HEAD-first ordering:
     - initialize workspace and create at least three active tasks;
     - run `list-tasks` with no HEAD to capture natural rows;
     - set HEAD to a non-first observed row;
     - run `list-tasks` again;
     - assert row 0 is the HEAD task and contains `[HEAD]`;
     - assert the remaining task IDs are the original observed IDs with HEAD removed.
   - Add a stale HEAD regression:
     - write `.playspec/HEAD` to a missing task ID;
     - run `list-tasks`;
     - assert exit code `0`, rows still print, and no row contains `[HEAD]`.
   - Add a no-HEAD active-list regression:
     - empty or remove `.playspec/HEAD`;
     - run `list-tasks`;
     - assert exit code `0`, rows print, and no row contains `[HEAD]`.

3. Validate targeted behavior.
   - Run the focused CLI tests for the new and nearby list-task cases.
   - Run `pnpm build`.
   - Run `pnpm test`.
   - Add a manual or targeted CLI command only if test output suggests a gap.

4. Write `docs/features/issue_86_show_head_task_first/result.md`.
   - Summarize the implementation.
   - Include exact validation commands and results.
   - Include any skipped commands with reasons.

## Files To Edit

- `src/cli/commands/list-tasks.ts`
- `tests/cli.test.ts`
- `docs/features/issue_86_show_head_task_first/result.md`
- `docs/features/issue_86_show_head_task_first/pr.md` before PR creation

## Active Entry Point Trace

`playspec list-tasks` -> Commander action in `src/cli/index.ts` -> `runListTasks()` -> read active summaries and HEAD -> derive display order -> resolve row phase labels -> print user-visible rows.

There is no persistence update for this feature. Reset/clear behavior is preserving existing behavior when HEAD is empty, missing, or stale.

## Old Paths And Bypasses

- Hidden `playspec list` delegates to `runListTasks()` and receives the same behavior.
- `current-task` is not a list view and should not be changed.
- MCP must remain untouched and must not gain HEAD fallback.
- `YamlTaskStore.listActiveTasks()` remains storage-only and should not know about HEAD.

## Risks

- Filesystem directory order is not a stable API. Tests must derive natural order from the first CLI run and assert relative movement rather than hardcoding order.
- Output parsing should target task rows, not phase text, because phase labels include spaces and punctuation.
- Stale HEAD should not become a warning unless an existing warning path already emits one. The acceptance criteria allow preserving current behavior.

## Rollback Notes

Rollback is simple: remove the display-order helper, restore iteration over `tasks`, and remove the new CLI tests. No persisted data or schema migration is involved.

## Completion Criteria

- Existing active HEAD appears as the first task row in `playspec list-tasks`.
- The first row is visibly marked with `[HEAD]`.
- Non-HEAD rows preserve their original relative order.
- Empty/no/stale HEAD cases do not crash and do not falsely mark a row.
- Real CLI tests cover the changed path.
- `pnpm build` and `pnpm test` pass.
