# PR: phase_completion_ledger

Fixes #31

## Summary

- Adds a typed per-task completion ledger at `.playspec/tasks/active/<taskId>/completions/index.yaml`.
- Writes one markdown audit record for every successful `PlaySpecCore.completePhase()` event.
- Adds event type resolution from workflow metadata, gate results, and stable phase-ID fallbacks.
- Adds read-only CLI commands for completion history:
  - `playspec log`
  - `playspec log --markdown`
  - `playspec show-completion <completionId>`

## Changed Files

- Core/types/schemas: `src/core/types.ts`, `src/core/schemas.ts`, `src/core/playspec-core.ts`
- Storage/paths: `src/storage/completion-ledger-store.ts`, `src/storage/index.ts`, `src/storage/yaml-task-store.ts`, `src/utils/paths.ts`
- CLI: `src/cli/index.ts`, `src/cli/commands/log.ts`, `src/cli/commands/show-completion.ts`
- Tests: `tests/integration/completion-engine.test.ts`, `tests/integration/routing.test.ts`, `tests/integration/task-store.test.ts`, `tests/cli.test.ts`
- Docs: `docs/features/phase_completion_ledger/spec.md`, `docs/features/phase_completion_ledger/plan.md`, `docs/features/phase_completion_ledger/result.md`

## Tests Run

- `pnpm build`
- `pnpm vitest run tests/integration/completion-engine.test.ts tests/integration/routing.test.ts tests/integration/task-store.test.ts`
- `pnpm vitest run tests/cli.test.ts`
- `pnpm test`

## PlaySpec Task

- `phase_completion_ledger`

## Risk Notes

- Ledger writes are not a database transaction with task state. They are protected by the existing task-root write lock and ordered markdown -> index -> `task.yaml`, so task state is not advanced if ledger writes fail.
- Read commands target active/completed task storage under `.playspec/tasks/active`, matching the issue scope.
- Reusable agent guidance: no new AGENTS.md guidance is needed; the existing repository rules already cover task-explicit core behavior, path aliases, and non-destructive operations.
