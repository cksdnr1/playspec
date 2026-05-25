# PR draft

Fixes #225

## Summary

- Reject `playspec specs --task <taskId>` when the selected task is not active.
- Preserve active explicit-task behavior, including leaving HEAD unchanged.
- Add CLI regression coverage that verifies completed explicit tasks fail before printing relevant file paths.

## Changed Files

- `src/cli/commands/specs.ts`
- `tests/cli.test.ts`
- `docs/features/issue_225_specs_completed_task_guard/spec.md`
- `docs/features/issue_225_specs_completed_task_guard/plan.md`
- `docs/features/issue_225_specs_completed_task_guard/result.md`
- `docs/features/issue_225_specs_completed_task_guard/pr.md`

## Tests Run

- `pnpm vitest run tests/cli.test.ts -t "specs"`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_225_specs_completed_task_guard`

## Risk Notes

- This intentionally removes the accidental `specs --task <completed>` inspection path.
- No archive lookup, resolver, MCP, or other workflow command behavior was changed.

## Reusable Agent Guidance

No reusable guidance update is needed. The existing repository rule to enforce active-task boundaries is sufficient; this fix is a local command guard.
