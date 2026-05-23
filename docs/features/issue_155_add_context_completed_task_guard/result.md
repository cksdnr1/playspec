# Issue 155 Add-Context Completed Task Guard Result

## Files Changed

- `src/core/playspec-core.ts`
- `src/cli/commands/add-context.ts`
- `tests/cli.test.ts`
- `docs/features/issue_155_add_context_completed_task_guard/spec.md`
- `docs/features/issue_155_add_context_completed_task_guard/plan.md`
- `docs/features/issue_155_add_context_completed_task_guard/result.md`

## Behavior Implemented

- `PlaySpecCore.addContextRef()` now rejects non-active tasks with `TaskNotActiveError` before duplicate handling or `contextRefs` mutation.
- `playspec add-context --edit --task <completedTaskId>` now rejects before creating `.playspec/tasks/active/<taskId>/sources/context_note_*.md`.
- Interactive HEAD-based `add-context` now rejects completed HEAD tasks before confirmation prompts or edit-note creation.
- Existing active-task add-context behavior and duplicate/path validation behavior remain unchanged.

## Verification Performed

- `pnpm exec tsc --noEmit`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

Focused CLI result: 179 tests passed.
Full suite result: 24 test files passed, 495 tests passed.

## Remaining Risks

- None identified for the scoped fix. Post-completion annotations remain intentionally out of scope.

## Safe Refactor Review

- Compared the local diff against the approved scope.
- Ran `git diff --check`; no whitespace errors.
- No refactor applied. The implementation is already limited to the shared core guard, CLI preflight, and focused tests.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/171
- Reusable agent guidance: no new guidance needed; existing lifecycle mutation guard expectations cover this pattern.
