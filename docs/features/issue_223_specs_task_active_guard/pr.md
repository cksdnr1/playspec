# Draft PR Notes

Fixes #223

## Summary

- Reject `playspec specs --task <taskId>` when the resolved task is not active, matching the existing HEAD-based lifecycle guard.
- Add a CLI regression that proves completed explicit tasks fail before `--path-only` can print relevant file paths.
- Record the mono-spec spec, plan, and result artifacts for issue #223.

## Changed Files

- `src/cli/commands/specs.ts`
- `tests/cli.test.ts`
- `docs/features/issue_223_specs_task_active_guard/spec.md`
- `docs/features/issue_223_specs_task_active_guard/plan.md`
- `docs/features/issue_223_specs_task_active_guard/result.md`
- `docs/features/issue_223_specs_task_active_guard/pr.md`

## Tests Run

- `pnpm vitest run tests/cli.test.ts -t specs`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_223_specs_task_active_guard`

## Risk Notes

- Intentional behavior change: `specs --task <completed>` no longer works as a read-only inspection shortcut.
- No migration, archive, MCP, storage schema, or unrelated lifecycle command behavior changed.

## Reusable Agent Guidance

No new reusable agent guidance is needed. The issue is a one-command lifecycle guard fix and does not introduce a repeatable workflow pattern beyond the existing active-task guard convention.
