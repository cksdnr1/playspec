# Draft PR Notes: Issue 86

Fixes #86

Draft PR: https://github.com/cksdnr1/playspec/pull/88

## Summary

- Shows the active HEAD task first in `playspec list-tasks` when HEAD points to an existing active task.
- Keeps the existing `[HEAD]` marker and preserves the relative order of all other task rows.
- Preserves current no-HEAD and stale-HEAD behavior without adding JSON output or changing storage/MCP behavior.

## Changed Files

- `src/cli/commands/list-tasks.ts`
- `tests/cli.test.ts`
- `docs/features/issue_86_show_head_task_first/spec.md`
- `docs/features/issue_86_show_head_task_first/plan.md`
- `docs/features/issue_86_show_head_task_first/result.md`
- `docs/features/issue_86_show_head_task_first/pr.md`

## Tests Run

- `pnpm install`
- `pnpm vitest run tests/cli.test.ts --testNamePattern "HEAD task first|HEAD is empty|missing task|marks the HEAD task|list-tasks"`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_86_show_head_task_first`

## Risk Notes

- Ordering remains display-only in the CLI command; storage ordering, schemas, and MCP behavior are unchanged.
- `list-tasks` currently has no JSON option, so JSON backward compatibility is preserved by not adding or changing JSON output.
