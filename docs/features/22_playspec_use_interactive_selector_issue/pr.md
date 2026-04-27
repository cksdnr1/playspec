# Make `playspec use` open an interactive selector

## Summary

This PR makes `playspec use` useful without copying task IDs by opening an interactive active-task selector when the command runs in a TTY and no task ID is provided.

- Changes the Commander entry point from `use <taskId>` to `use [taskId]` so command logic can handle the no-argument path.
- Preserves the explicit `playspec use <taskId>` flow through the same task validation and `.playspec/HEAD` write behavior.
- Adds a raw-mode arrow-key selector that lists active tasks with ID, title, workflow type, effective phase display, and `[HEAD]` marker.
- Adds controlled, non-mutating failures for non-interactive no-arg use, empty active-task lists, and selector cancellation.
- Adds focused CLI coverage for explicit use, non-interactive failure, PTY selection, cancellation, empty active tasks, effective phase display, invalid phase display, and task read-only behavior.
- Updates README usage examples to show both interactive and explicit task switching.

## Reviewer Notes

The corrected no-argument path is:

`playspec use` -> Commander `use [taskId]` action -> `runUse(workspaceRoot, undefined)` -> `isInteractiveCli()` gate -> `YamlTaskStore.listActiveTasks()` -> `readHeadTaskId()` plus `resolveEffectivePhaseDisplay()` builds selector rows -> arrow-key selector returns a task ID -> shared `setHeadToTask()` validates with `store.getTask()` -> `.playspec/HEAD` is rewritten -> the CLI prints `HEAD set to: <taskId>` and the selected task title.

The explicit scripted path stays short:

`playspec use <taskId>` -> `runUse(workspaceRoot, taskId)` -> shared `setHeadToTask()` -> `store.getTask(taskId)` validation -> `.playspec/HEAD` write.

Cancellation and empty-list handling happen before the shared HEAD writer is called, so they leave `.playspec/HEAD` unchanged. The selector restores raw mode, cursor visibility, input listeners, and stdin pause state before resolving, rejecting, or propagating an unexpected selector error.

No task data update, phase completion, evidence, snapshot, context validation, MCP behavior, archive/delete, or viewer work is part of this change.

## Files Changed

- `src/cli/index.ts`
  - Registers `playspec use [taskId]` and passes `string | undefined` into command logic.
- `src/cli/commands/use.ts`
  - Keeps explicit `use <taskId>` behavior.
  - Adds non-interactive no-arg error handling.
  - Adds active-task selector row construction using existing HEAD and effective-phase helpers.
  - Adds the arrow-key selector and routes selected IDs through the shared HEAD writer.
- `tests/cli.test.ts`
  - Adds explicit, non-interactive, PTY selection, cancellation, empty-list, effective-phase, invalid-phase, and read-only assertions for `use`.
- `README.md`
  - Documents no-arg interactive `playspec use` alongside `playspec use <taskId>`.
- `docs/features/22_playspec_use_interactive_selector_issue/result.md`
  - Records final implementation notes, validation commands, known limitations, and reusable guidance decision.

## Validation

- `pnpm vitest run tests/cli.test.ts -t "use" --testTimeout 15000`
  - Passed 8 focused tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Failed because `tests/cli.test.ts > CLI placeholder > marks the HEAD task in list and list-tasks output` hit the default 5000ms timeout after 217 tests had passed.
- `pnpm test -- --testTimeout 15000`
  - Passed all 16 files and 218 tests.

## Risks and Limitations

- The selector is a small raw-mode implementation rather than an external prompt dependency. It has PTY coverage for arrow selection and cancellation, but terminal behavior can still vary by platform.
- PTY tests rely on the Unix `script` command.
- Ctrl+C cancellation is implemented through the same selector cancellation path as Escape, but the focused PTY test covers Escape only.
- The command intentionally does not validate context ref target files, preserving the required behavior, but there is no focused missing-context-ref regression test.
- `docs/features/22_playspec_use_interactive_selector_issue/plan.md` was requested as source material but is not present in this branch. This PR text is based on the current diff against `origin/master`, `spec.md`, `result.md`, and the source problem.

## Reusable Agent Guidance

No new reusable agent guidance should be documented for this change. Existing project guidance already covers scoped implementation, subagent verification, and build validation. The useful lesson is specific to terminal selector testing and is captured in this feature's result and PR notes rather than promoted to a global rule.
