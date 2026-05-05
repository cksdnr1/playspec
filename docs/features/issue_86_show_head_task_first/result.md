# Issue 86 Implementation Result

## Summary

Implemented `playspec list-tasks` display ordering so an existing active HEAD task is printed first and remains visibly marked with `[HEAD]`. Non-HEAD task rows keep their original relative order. Empty or stale HEAD values keep the current non-crashing list behavior and do not mark any row.

Draft PR: https://github.com/cksdnr1/playspec/pull/88

## Files Changed

- `src/cli/commands/list-tasks.ts`
  - Added command-local `orderTasksForDisplay()` over `TaskSummary[]`.
  - Kept storage order unchanged and applied HEAD-first ordering only before printing rows.
  - Preserved the existing header, phase display, and `[HEAD]` marker.
- `tests/cli.test.ts`
  - Added `parseListTaskRows()` for real CLI output assertions.
  - Added real CLI coverage for HEAD-first ordering with non-HEAD relative order preservation.
  - Added empty HEAD and stale HEAD regressions.
- `docs/features/issue_86_show_head_task_first/spec.md`
  - Added the approved technical spec and validation patch ledger.
- `docs/features/issue_86_show_head_task_first/plan.md`
  - Added the approved implementation plan.

## Behavior Verified

- `playspec list-tasks` now lifts an existing active HEAD task to row 1 after the header.
- The lifted row contains `[HEAD]`.
- Remaining task rows preserve their observed relative order.
- Empty HEAD lists active tasks without a marker.
- Stale HEAD lists active tasks without crashing and without a false marker.
- `list-tasks` still has no JSON option or JSON shape change.
- Deprecated hidden `playspec list` delegates to `runListTasks()` and inherits the same behavior.

## Validation

Run:

- `pnpm install` - passed.
- `pnpm vitest run tests/cli.test.ts --testNamePattern "HEAD task first|HEAD is empty|missing task|marks the HEAD task|list-tasks"` - passed, 9 matching tests.
- `pnpm build` - passed.
- `pnpm test` - passed, 23 test files and 391 tests.

Post-implementation review:

- `spec_verifier` - passed, 98/100.
- `refactor_guard` - allowed.
- `build_validator` - passed.
- `safe_refactor` - extracted repeated mono-spec test setup into `createMonoSpecTasks()` in `tests/cli.test.ts`; focused CLI tests and build still passed. The safe-refactor agent also reported `pnpm test` passing with 391 tests.

Skipped:

- No manual JSON command was run because `list-tasks` has no JSON option in the current CLI.

## Remaining Risks

- Task listing order still originates from filesystem directory order. The feature intentionally preserves that order for non-HEAD tasks instead of changing storage semantics.
- No data migration or persisted task mutation is involved.

## Reusable Agent Guidance

No reusable AGENTS.md guidance change is needed. The existing repository rules already cover the relevant boundary: HEAD fallback is CLI-only, storage/core/MCP should not be coupled to `.playspec/HEAD`, and feature docs remain in `docs/features/`.
