# GitHub Issue 84 Lightweight Task Links Implementation Plan

## Ordered Implementation Steps

1. Add task link model support.
   - Edit `src/core/types.ts` with `TaskLinkType`, `TaskLink`, `TaskRecord.links?`, and `CreateTaskInput.links?`.
   - Edit `src/core/schemas.ts` with strict zod validation for `parent | after | related`.
   - Edit `src/storage/yaml-task-store.ts` so `createTask()` persists input links when present.
   - Compatibility criterion: existing task YAML without `links` still parses.

2. Add reusable task ID resolution.
   - Create `src/core/task-id-resolver.ts`.
   - Resolve exact active/completed task IDs first.
   - Fall back to unique prefix.
   - Throw helpful errors for no match and ambiguous prefix.
   - Keep HEAD resolution in `ActiveTaskResolver`; do not move HEAD logic into Core.

3. Add Core link mutation helpers.
   - Edit `src/core/playspec-core.ts`.
   - Add `addTaskLink(sourceTaskId, targetTaskId, type)` and `removeTaskLink(sourceTaskId, targetTaskId, type?)`.
   - Validate source/target existence through the store.
   - Reject self-links.
   - Duplicate add is a no-op result with warning text for CLI.
   - Missing unlink is a no-op result with warning text for CLI.
   - Stamp added links with `createdAt` and `createdBy: 'cli'`.

4. Wire create-time link flags.
   - Edit `src/cli/index.ts` to add `--parent <taskId>` and `--after <taskId>` only.
   - Edit `src/cli/commands/create.ts` to resolve link targets before `createTask()`.
   - Persist outgoing links on the newly created task.
   - Print created task ID clearly and print resolved prefix mappings.
   - Do not add `--related` to create.

5. Add `playspec link`.
   - Create `src/cli/commands/link.ts`.
   - Support `playspec link <sourceTaskId> <targetTaskId> --as parent|after|related`.
   - Support `playspec link --to <targetTaskId> --as parent|after|related` using current HEAD as source.
   - Resolve source and target by exact/prefix IDs before mutation.
   - If HEAD is absent for shorthand, fail with guidance to run `playspec use <taskId>` or pass source explicitly.

6. Add `playspec unlink`.
   - Create `src/cli/commands/unlink.ts`.
   - Support explicit and `--to` shorthand forms.
   - If `--as` is omitted, remove all links from source to target.
   - Surface no-op warnings for missing links.

7. Update status rendering.
   - Edit `src/cli/index.ts` so `status [taskId]` accepts a positional task ID while keeping `--task`.
   - Edit `src/cli/commands/status.ts`.
   - Resolve explicit task IDs with the new resolver; keep HEAD fallback for no argument.
   - Display outgoing `Parents`, `After`, `Related`.
   - Scan active/completed tasks for incoming `Includes`, `Followed by`, and `Related by`.
   - Add direct-only suggested-next for parent tasks.

8. Add prompt linked-task context.
   - Edit `src/core/playspec-core.ts`.
   - When the task has outgoing links, append a compact `Linked task context:` block to the rendered prompt.
   - Leave prompts for tasks without links unchanged.

9. Add focused tests.
   - Add `tests/integration/task-links.test.ts`.
   - Cover schema compatibility with and without links.
   - Cover resolver exact, unique-prefix, ambiguous, and no-match behavior.
   - Cover create `--parent`, `--after`, and both together.
   - Cover absence of create `--related`.
   - Cover explicit-source and current-task `link`/`unlink`.
   - Cover duplicate add and missing unlink warnings.
   - Cover self-link rejection.
   - Cover status outgoing/incoming/suggested-next.
   - Cover prompt linked context and no-link prompt unchanged.

10. Validate real user-visible paths.
    - Inspect scripts and lockfile first.
    - Run `pnpm build`.
    - Run `pnpm test`.
    - Exercise CLI in a temporary workspace for create/link/unlink/status/prompt.
    - Confirm YAML contains outgoing links only.

## Old Paths, Bypasses, And Partial Migration Risks

- `ActiveTaskResolver` exact-only lookup remains valid for HEAD and old `--task` paths but must not be reused for link refs that require prefix resolution.
- `status --task` currently resolves exact IDs only; the implementation must close this partial behavior for explicit status input.
- `YamlTaskStore.updateTask()` can persist arbitrary patches after schema validation; Core link helpers must be the mutation boundary for CLI commands.
- Existing tasks without links must remain unchanged and should not gain empty `links: []` unless a mutation touches them.

## Risks And Controls

- Risk: broad graph behavior leaks into status. Control: direct-only scans and tests.
- Risk: prefix ambiguity causes wrong links. Control: exact first, unique only, ambiguity error.
- Risk: inverse relationships are accidentally written. Control: tests assert only source task YAML changes.
- Risk: prompt output changes for unlinked tasks. Control: no-link prompt regression test.

## Completion Criteria

- Runtime feature implemented through CLI/Core/store paths.
- Reviewer-facing docs remain in `docs/features/github_issue_84_lightweight_task_links_implementation/`.
- Issue #82 docs remain untouched.
- `pnpm build` and `pnpm test` pass.
- Manual CLI smoke test proves create/link/unlink/status/prompt.
- Quality gate remains at least 95/100.
