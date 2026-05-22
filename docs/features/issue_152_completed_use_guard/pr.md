# PR: Reject Completed Tasks In Explicit Use

Fixes #152

## Summary

- Added an explicit active-status guard before `playspec use <taskId>` writes `.playspec/HEAD`.
- Reused the existing `TaskNotActiveError` so completed-task selection reports the lifecycle problem with an active-task recovery hint.
- Added CLI regression coverage that verifies completed-task selection fails and preserves the previous active HEAD.

## Changed Files

- `src/cli/commands/use.ts`
- `tests/cli.test.ts`
- `docs/features/issue_152_completed_use_guard/spec.md`
- `docs/features/issue_152_completed_use_guard/plan.md`
- `docs/features/issue_152_completed_use_guard/result.md`
- `docs/features/issue_152_completed_use_guard/pr.md`

## Tests Run

- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_152_completed_use_guard`

## Risk Notes

- Low risk. The change is limited to the explicit `use` HEAD mutation path.
- Missing-task suggestions and no-argument interactive `use` behavior are unchanged.
- No reusable agent guidance needs to be documented for this one-off lifecycle guard.
