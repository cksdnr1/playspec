# Implementation Plan: Completed Source Link Guard

## Ordered Steps

1. Add core guard in `src/core/playspec-core.ts`.
   - In `addTaskLink()`, after `const source = await this.taskStore.getTask(sourceTaskId);`, call `this.assertTaskIsActive(source);`.
   - In `removeTaskLink()`, after loading the source task, call the same guard.
   - Keep validation order for link type and self-link unchanged.
   - Keep target lookup behavior unchanged for active sources.

2. Add focused CLI regression coverage in `tests/integration/task-links.test.ts`.
   - Use existing task link CLI helpers and temp workspace setup.
   - Create active source/target tasks, seed source links where needed, then mark the source completed through `YamlTaskStore.updateTask()`.
   - Explicit-source coverage:
     - `playspec link <completedSource> <target> --as related` fails.
     - `playspec unlink <completedSource> <target>` fails.
     - Assert stderr contains `Task "<source>" is not active`.
     - Assert the completed source `links` field is unchanged after each failed command.
   - HEAD/`--to` coverage:
     - Set HEAD to the completed source.
     - `playspec link --to <target> --as related` fails.
     - `playspec unlink --to <target>` fails.
     - Assert failure message and unchanged `links`.

3. Run focused and full validation.
   - `pnpm test -- tests/integration/task-links.test.ts`
   - `pnpm build`
   - `pnpm test`

4. Record results in `docs/features/issue_157_completed_source_link_guard/result.md`.

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/integration/task-links.test.ts`
- `docs/features/issue_157_completed_source_link_guard/result.md`
- `docs/features/issue_157_completed_source_link_guard/pr.md`

## Tests To Add Or Update

- Add one or two focused integration tests under the existing `lightweight task links` describe block.
- Assertions must cover command exit code, inactive-task stderr, and exact unchanged task `links`.
- The tests should cover at least one explicit source path and one HEAD shorthand path.

## Entry Point Trace

Explicit source:

`playspec link/unlink args -> CLI resolves source/target -> core loads source -> assert active -> no mutation on completed source -> CLI exits non-zero with inactive task error`.

HEAD shorthand:

`playspec link/unlink --to -> ActiveTaskResolver resolves HEAD source -> CLI resolves target -> core loads source -> assert active -> no mutation on completed source -> CLI exits non-zero with inactive task error`.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: direct CLI link/unlink could mutate completed source tasks.
- Bypass path: direct core callers, including MCP, currently share the same gap. Core-level guard closes this without adding CLI-only branching.
- Partial migration risk: placing the guard only in CLI would leave direct core callers unprotected. This plan avoids that by changing core methods.

## Risks

- Low compatibility risk. This intentionally rejects a mutation that other lifecycle-sensitive core methods already reject.
- Low test risk. Existing integration helpers already cover link/unlink command behavior.

## Rollback Notes

Rollback is a small revert of the two guard calls and the regression tests. No data migration is involved.

## Completion Criteria

- Completed source task link and unlink mutations fail through explicit source and HEAD shorthand paths.
- The completed source task `links` field remains byte-for-byte semantically unchanged in rejected cases.
- Focused integration test, build, and full test suite pass.
