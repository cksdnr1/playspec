# PlaySpec Update 7 Automation Safety Harness Plan

## Ordered Implementation Steps

1. Add harness domain model and validation.
   - Edit `src/core/types.ts` with harness attempt, reset event, record, and result interfaces.
   - Edit `src/core/schemas.ts` with zod schemas that validate persisted `harness.yaml`.
   - Add defaults for missing state at the core layer, not in `TaskRecord`.

2. Add task-scoped harness path support.
   - Edit `src/utils/paths.ts` with `getHarnessRecordPath(workspaceRoot, taskId)`.
   - Store only under `.playspec/tasks/active/{taskId}/harness.yaml`.

3. Add core harness behavior.
   - Edit `src/core/playspec-core.ts`.
   - Add `getHarnessStatus(taskId, phaseId?)`.
   - Add `recordHarnessAttempt(taskId, phaseId, result, reason?)`.
   - Add `resetHarness(taskId, reason?)`.
   - Use `withWriteLock(taskRoot, ...)` for attempt/reset writes.
   - Validate loaded and written records through `HarnessRecordSchema`.
   - Use `TaskNotActiveError` for non-active tasks.
   - Failure increments `attemptCount`.
   - At `attemptCount >= retryBudget`, set `blocked: true` and `circuitBreaker: true`.
   - Success clears `lastFailureReason`, `blocked`, and `circuitBreaker`, while preserving counters and reset events.
   - Reset appends a reset event with previous blocked/circuit values and clears blocked/circuit flags without deleting the file.

4. Add CLI command group.
   - Add `src/cli/commands/harness.ts`.
   - Register `playspec harness status`, `attempt`, and `reset` in `src/cli/index.ts`.
   - Require `--task` for all harness commands.
   - Require `--phase` and `--result` for `attempt`.
   - Accept result values `success` and `failure`.
   - Print concise status with task ID, phase ID, attempt count, retry budget, blocked, circuit breaker, last result, last reason, and reset event count.

5. Add tests.
   - Add `tests/integration/harness-store.test.ts` for core persistence and state transitions.
   - Update `tests/cli.test.ts` for command registration and user-visible CLI behavior.
   - Keep existing `tests/integration/mcp-server.test.ts` no-HEAD-fallback coverage; no MCP harness tool is added.

6. Add reviewer docs.
   - Update `docs/features/playspec_update_7_automation_safety_harness/result.md` after implementation and validation.
   - Update `docs/features/playspec_update_7_automation_safety_harness/pr.md` before PR creation.

## Entry Point To State Chain

- CLI `harness attempt` receives explicit task/phase/result.
- CLI constructs `YamlTaskStore` and `PlaySpecCore`.
- Core loads the active task and rejects non-active tasks.
- Core loads existing `harness.yaml` if present or initializes a default record for the task/phase.
- Core validates, mutates attempt status, validates again, and writes atomically under the active task root.
- CLI prints the new blocked/circuit state.
- Reset appends an audit event and clears safety blockers without deleting phase history, evidence, snapshots, or `harness.yaml`.

## Files To Edit

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/utils/paths.ts`
- `src/cli/index.ts`
- `src/cli/commands/harness.ts`
- `tests/cli.test.ts`
- `tests/integration/harness-store.test.ts`
- `docs/features/playspec_update_7_automation_safety_harness/result.md`
- `docs/features/playspec_update_7_automation_safety_harness/pr.md`

## Tests

- Core default status returns a valid non-blocked record when `harness.yaml` is absent.
- Failure attempts increment and block at the retry budget.
- Additional failure while circuit breaker is active is rejected until reset.
- Success clears transient failure reason and blocked/circuit state.
- Reset persists previous blocked/circuit state in an append-only reset event and preserves evidence files.
- CLI help includes `harness`.
- CLI status, attempt, and reset print user-visible state.
- Existing MCP no-HEAD-fallback tests remain passing.

## Old Paths, Bypasses, And Partial Migration Risks

- Do not embed harness fields in `task.yaml`; older task records must continue to load.
- Direct `harness.yaml` edits are possible, so every core read validates before use.
- Do not reuse migration or evolution stores for harness state.
- Do not add `playspec harness run` or proposal generation commands.
- Do not change prompt rendering or completion behavior unless a future harness mode explicitly enables it.

## Rollback Notes

The implementation is additive. Reverting the new CLI registration, command file, core methods, schemas, and tests removes the feature. Runtime-created `harness.yaml` files are task-scoped artifacts and do not affect task loading because they are outside `task.yaml`.

## Completion Criteria

- `playspec harness status --task <taskId>` reports valid default or persisted state.
- `playspec harness attempt` records success/failure state and blocks at the retry budget.
- `playspec harness reset` clears blocked/circuit state and records a reset event.
- No MCP harness command is registered.
- Reviewer docs are present under `docs/features/playspec_update_7_automation_safety_harness/`.
- `pnpm build` and relevant vitest commands pass.
