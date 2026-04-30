# Draft PR Notes

Fixes #25

## Summary

- Added a compact current-task summary after successful `playspec use <taskId>`.
- Replaced ambiguous task identity labels with `Task ID` in current/list/use-facing outputs.
- Added title/slug/close-match suggestions when `playspec use <value>` is not an exact task ID.
- Kept explicit `use` HEAD-only and display-only after the write, including missing context-ref safety.

## Changed Files

- `src/cli/cli-utils.ts`
- `src/cli/commands/use.ts`
- `src/cli/commands/list-tasks.ts`
- `src/cli/commands/current-task.ts`
- `src/cli/commands/current.ts`
- `tests/cli.test.ts`
- `docs/features/playspec_use_task_identity_and_phase_summary/spec.md`
- `docs/features/playspec_use_task_identity_and_phase_summary/plan.md`
- `docs/features/playspec_use_task_identity_and_phase_summary/result.md`
- `docs/features/playspec_use_task_identity_and_phase_summary/pr.md`

## Tests Run

- `pnpm install`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

Skipped: none.

## PlaySpec Task ID

`playspec_use_task_identity_and_phase_summary`

## Risk Notes

- Human-facing CLI output changed intentionally for issue #25.
- Suggestion matching is deterministic and does not auto-select ambiguous title-like input.
- No reusable agent guidance needs to be documented for this issue.

## PR Link

Pending draft PR creation.
