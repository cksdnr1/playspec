# Draft PR

Fixes #185

## Summary

- Reject `playspec create --phase --from <taskId>` when the referenced planning task is not completed.
- Add a phase-execution-specific error message that tells the operator a completed planning task is required.
- Add a CLI regression proving an active planning task with valid artifacts does not create an execution task or mutate HEAD.

## Changed Files

- `src/cli/commands/create.ts`
- `src/core/errors.ts`
- `tests/cli.test.ts`
- `docs/features/issue_185_reject_active_from_planning_task/spec.md`
- `docs/features/issue_185_reject_active_from_planning_task/plan.md`
- `docs/features/issue_185_reject_active_from_planning_task/result.md`
- `docs/features/issue_185_reject_active_from_planning_task/pr.md`

## Tests Run

- `pnpm test -- tests/cli.test.ts -t "rejects --phase --from when the planning task is not completed"`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_185_reject_active_from_planning_task`

## Risk Notes

- Local scripts that intentionally passed active planning tasks as explicit phase-execution sources will now fail. That is the intended lifecycle boundary and matches the existing completed-only automatic discovery path.
- No reusable agent guidance change is needed; this is a narrow CLI lifecycle fix.
