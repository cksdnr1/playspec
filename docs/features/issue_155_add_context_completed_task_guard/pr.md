# PR: Issue 155 Add-Context Completed Task Guard

Fixes #155

## Summary

- Add the shared active-task lifecycle guard to `PlaySpecCore.addContextRef()` so CLI and MCP callers cannot append context refs to completed tasks.
- Add CLI preflight for `add-context --edit` and interactive HEAD resolution so completed tasks are rejected before confirmation prompts or context note creation.
- Add CLI regression coverage for explicit completed-task rejection and edit-note preflight.

## Changed Files

- `src/core/playspec-core.ts`
- `src/cli/commands/add-context.ts`
- `tests/cli.test.ts`
- `docs/features/issue_155_add_context_completed_task_guard/spec.md`
- `docs/features/issue_155_add_context_completed_task_guard/plan.md`
- `docs/features/issue_155_add_context_completed_task_guard/result.md`
- `docs/features/issue_155_add_context_completed_task_guard/pr.md`

## Tests Run

- `pnpm exec tsc --noEmit`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_155_add_context_completed_task_guard`

## Risk Notes

- Core remains the authoritative mutation boundary.
- The extra CLI preflight is intentionally limited to preventing `--edit` note files and interactive prompts for completed tasks before core mutation.
- No archive, lifecycle redesign, or post-completion annotation behavior is changed.

## Reusable Agent Guidance

No new reusable agent guidance is needed. The existing repository rule to guard lifecycle mutations on active tasks already covers this pattern.
