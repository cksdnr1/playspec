# phase_completion_ledger Result

## Implemented Behavior

- Added a typed completion ledger stored at `.playspec/tasks/active/<taskId>/completions/index.yaml`.
- Added one markdown completion record per successful `PlaySpecCore.completePhase()` call.
- Completion events include sequence/id, phase/title, timestamp, type/result, previous/next phase, status after completion, git HEAD, evidence files, snapshot files, optional review file, rollback safe point ID, and markdown path.
- Completion event creation runs inside the existing task-root completion lock and writes markdown, then index, then `task.yaml`.
- Event type mapping supports workflow metadata (`completion.eventType`, `gate.eventTypes`, legacy top-level `eventTypes`), gate results, and phase-ID fallbacks.
- Added read-only CLI commands:
  - `playspec log [--task <taskId>]`
  - `playspec log --markdown [--task <taskId>]`
  - `playspec show-completion <completionId> [--task <taskId>]`

## Files Changed

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/storage/completion-ledger-store.ts`
- `src/storage/index.ts`
- `src/storage/yaml-task-store.ts`
- `src/utils/paths.ts`
- `src/cli/index.ts`
- `src/cli/commands/log.ts`
- `src/cli/commands/show-completion.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/routing.test.ts`
- `tests/integration/task-store.test.ts`
- `tests/cli.test.ts`

## Verification

- `pnpm build`
- `pnpm vitest run tests/integration/completion-engine.test.ts tests/integration/routing.test.ts tests/integration/task-store.test.ts`
- `pnpm vitest run tests/cli.test.ts`
- `pnpm test`

Full test result: 24 test files passed, 442 tests passed.

## Remaining Risks

- `index.yaml`, markdown, and `task.yaml` are not a database transaction. The implementation uses the existing task-root write lock and writes ledger artifacts before task state to avoid advancing task state when ledger writes fail.
- Read commands currently target active/completed task storage, matching the issue scope. Archived-task ledger reads can be added later if archive UX requires it.
