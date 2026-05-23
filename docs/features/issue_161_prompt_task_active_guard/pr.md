# Draft PR

Fixes #161

## Summary

- Reject `playspec prompt --task <completedTaskId>` immediately after task resolution when the task is not active.
- Apply the same active-task guard to deprecated `playspec next --task <completedTaskId>`.
- Add CLI regression coverage for quiet prompt rejection, `--out` artifact prevention, and explicit completed `next` rejection.

## Changed Files

- `src/cli/commands/prompt.ts`
- `src/cli/commands/next.ts`
- `tests/cli.test.ts`
- `docs/features/issue_161_prompt_task_active_guard/spec.md`
- `docs/features/issue_161_prompt_task_active_guard/plan.md`
- `docs/features/issue_161_prompt_task_active_guard/result.md`
- `docs/features/issue_161_prompt_task_active_guard/pr.md`

## Tests Run

- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_161_prompt_task_active_guard`

## Risk Notes

- `playspec next` still emits its deprecation warning before the lifecycle error, preserving existing command behavior.
- No reusable agent guidance was added; this was a narrow lifecycle guard fix rather than a repeatable workflow/process change.
