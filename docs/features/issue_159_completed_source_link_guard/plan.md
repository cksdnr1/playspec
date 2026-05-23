# Issue 159 Completed Source Link Guard Plan

## Ordered Implementation Steps

1. Add failing integration coverage in `tests/integration/task-links.test.ts`.
   - Explicit `playspec link <completedSource> <target> --as parent` rejects with non-zero exit.
   - Explicit `playspec unlink <completedSource> <target>` rejects with non-zero exit.
   - HEAD shorthand `playspec link --to <target> --as parent` rejects when HEAD points at a completed source.
   - HEAD shorthand `playspec unlink --to <target>` rejects when HEAD points at a completed source.
   - For each rejected command, read the completed source `task.yaml` before and after and assert no YAML mutation.

2. Add the core active-source guard in `src/core/playspec-core.ts`.
   - In `addTaskLink()`, call `this.assertTaskIsActive(source)` immediately after `const source = await this.taskStore.getTask(sourceTaskId);`.
   - In `removeTaskLink()`, call the same guard immediately after loading the source.
   - Keep self-link and link type validation as-is before task reads.
   - Keep target task existence resolution unchanged for active sources.

3. Verify active source behavior is preserved.
   - Existing duplicate-link warning and missing-link warning tests should continue to pass.
   - Existing active shorthand link/unlink success paths should continue to pass.

4. Run required validation.
   - Focused task-link integration file.
   - CLI lifecycle guard coverage in `tests/cli.test.ts`.
   - Build after tests.

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/integration/task-links.test.ts`
- `docs/features/issue_159_completed_source_link_guard/result.md`
- `docs/features/issue_159_completed_source_link_guard/pr.md`

## Tests To Add Or Update

- Add four integration assertions to `tests/integration/task-links.test.ts`.
- Reuse existing helpers where possible: `initWorkspace()`, `runCli()`, and `readTaskYaml()`.
- Use `YamlTaskStore.updateTask(taskId, { status: 'completed' })` to model completed tasks that remain in active storage.
- Assert `stderr` contains `Task "<sourceTaskId>" is not active (status: completed).`.
- Assert the completed source YAML is unchanged after each rejected command.

## End-To-End Chain

Explicit source:

`playspec link/unlink <source> <target>` -> CLI resolves source with `TaskIdResolver` -> CLI resolves target -> `PlaySpecCore` loads source -> active guard rejects completed source -> no `taskStore.updateTask()` call -> CLI exits non-zero with `TaskNotActiveError`.

HEAD shorthand:

`playspec link/unlink --to <target>` -> CLI resolves source with `ActiveTaskResolver` from HEAD -> CLI resolves target -> `PlaySpecCore` loads source -> active guard rejects completed source -> source YAML remains unchanged.

## Old Paths, Bypass Paths, Partial Migration Risks

- Old path: both core mutation methods currently mutate completed source tasks after ID resolution.
- Bypass path closed: `--to` HEAD shorthand cannot bypass the guard because it still calls the guarded core methods.
- Partial migration risk: adding the guard only in CLI would leave programmatic callers mutable; the plan uses core to avoid that gap.

## Risks

- Completed-source duplicate add and missing unlink attempts will now fail instead of warning. This is expected because lifecycle rejection must happen before completed source mutation semantics.
- Target task mutability remains unchanged; do not add a target active guard.

## Rollback Notes

Rollback is limited to removing the two core guard calls and the new tests/docs for this feature. No storage migration or task data transformation is introduced.

## Completion Criteria

- All four completed-source rejection cases fail non-zero and report the source task is not active.
- Completed source `task.yaml` is unchanged after rejected link/unlink commands.
- Existing active-task link/unlink behavior still passes.
- Required tests and build complete successfully.
