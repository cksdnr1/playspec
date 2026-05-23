# Implementation Result

## Files Changed

- `src/cli/commands/prompt.ts`
- `src/cli/commands/next.ts`
- `tests/cli.test.ts`
- `docs/features/issue_161_prompt_task_active_guard/spec.md`
- `docs/features/issue_161_prompt_task_active_guard/plan.md`
- `docs/features/issue_161_prompt_task_active_guard/result.md`

## Behavior Implemented

- `playspec prompt --task <completedTaskId>` now rejects immediately after task resolution when the task status is not `active`.
- `playspec next --task <completedTaskId>` now uses the same lifecycle guard while preserving its existing deprecation warning.
- Completed explicit prompt requests fail before prompt rendering, copying, or output artifact writes.
- Existing active explicit-task behavior remains routed through the same render/output path after the guard passes.

## Verification Performed

- Focused tests updated in `tests/cli.test.ts`:
  - explicit completed `prompt --task` with `--print-only --quiet`
  - explicit completed `prompt --task` with `--out` and no artifact written
  - explicit completed `next --task` lifecycle error wording
- `pnpm test -- tests/cli.test.ts`
  - 180 tests passed.
- `pnpm build`
  - TypeScript build and alias rewrite passed.
- `pnpm test`
  - 24 test files passed.
  - 499 tests passed.

## Failures

- None.

## Remaining Test Gaps

- No separate unit test was added for the guard because the behavior is CLI lifecycle ordering and artifact prevention; the regression coverage exercises the user-visible command paths directly.

## Refactor Review

- Reviewed the branch diff against `origin/master`.
- No safe refactor was needed; the implementation is already limited to two command guard checks and focused CLI tests.
- Intentionally skipped adding a shared helper because duplicating the existing one-line guard in the two command entry points is clearer and avoids a new abstraction for a narrow lifecycle fix.

## PR Preparation

- Draft PR notes written to `docs/features/issue_161_prompt_task_active_guard/pr.md`.
- Reusable agent guidance: not documented. This change does not introduce a new repeatable agent workflow; it applies an existing lifecycle rule to two command entry points.
- PR link: pending branch push and draft PR creation.

## Remaining Risks

- `playspec next` still prints its deprecation warning before the lifecycle error. This preserves existing behavior and does not weaken the completed-task guard.
- Other commands with explicit task options were intentionally left unchanged unless they were in issue scope.
