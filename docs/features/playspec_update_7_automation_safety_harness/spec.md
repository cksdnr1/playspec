# PlaySpec Update 7 Automation Safety Harness Spec

## Scope

Implement only Phase 7, "Automation Safety Harness", from `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`.

In scope:

- Persist harness state at `.playspec/tasks/active/{taskId}/harness.yaml`, outside `task.yaml`.
- Add zod-validated harness record, reset event, attempt result, and core result types.
- Add core methods to read status, record attempts, and reset blocked/circuit state.
- Add human CLI commands:
  - `playspec harness status --task <taskId>`
  - `playspec harness attempt --task <taskId> --phase <phaseId> --result <success|failure> [--reason <text>]`
  - `playspec harness reset --task <taskId> [--reason <text>]`
- Surface failures as explicit user-visible blocked/circuit state.
- Keep normal phase history, evidence, routing, prompt rendering, and completion behavior intact.

Out of scope:

- Phase 7.1 automatic proposal generation.
- A general autonomous runner.
- Changes to routing semantics beyond safety gates.
- Mutation of proposal, migration, workflow, template, or rule assets.
- Storing harness data inside `TaskRecord`.

## Use Case Alignment

PlaySpec may be driven by repeated automated agent attempts. Users need a durable safety state that records failed attempts, blocks further automated work after a retry budget is exhausted, exposes circuit-breaker state, and allows explicit reset with an audit event.

The first user-visible slice is command-driven and inspectable. It does not start or retry agents by itself.

## High-Level Current Implementation Summary

Verified current behavior:

- Active task state is stored as YAML under `.playspec/tasks/active/{taskId}/task.yaml`.
- `TaskRecordSchema` validates task records; active task loading should remain stable.
- `PlaySpecCore` owns task workflow behavior and uses `withWriteLock(taskRoot, ...)` around task-scoped mutations.
- Human CLI commands may resolve HEAD through `ActiveTaskResolver`.
- MCP context resolution uses `resolveMcpTaskId()` and must not read `.playspec/HEAD`.
- Prompt and completion already have explicit opt-in evolution context behavior from earlier phases.

Inferred behavior:

- Harness state should follow task-scoped mutation patterns in `PlaySpecCore`, but should be stored in a separate file to avoid changing task schema compatibility.
- The CLI can use HEAD fallback when `--task` is omitted if that follows existing human command behavior, but the phase examples require explicit task context for reset and task-specific commands.

Open question resolved for this slice:

- Optional MCP harness status is omitted. The phase says optional, and leaving it out preserves MCP surface area while still retaining the required no-HEAD-fallback regression.

## Relevant Files Reviewed

- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/core/errors.ts`
- `src/cli/index.ts`
- `src/cli/commands/status.ts`
- `src/storage/yaml-task-store.ts`
- `src/utils/paths.ts`
- `src/mcp/server.ts`
- `src/mcp/context.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts`

## Active Entry Points And Bypasses

Proposed active entry points:

- `playspec harness status --task <taskId>` reads and validates `harness.yaml`, or returns default empty harness state when no file exists.
- `playspec harness attempt --task <taskId> --phase <phaseId> --result failure --reason <text>` increments the failure count for the task/phase and sets blocked/circuit flags when the retry budget is exhausted.
- `playspec harness attempt --task <taskId> --phase <phaseId> --result success` clears transient failure reason and blocked/circuit flags for that phase without deleting reset history.
- `playspec harness reset --task <taskId> --reason <text>` appends a reset event and clears blocked/circuit fields.

Bypasses and old paths:

- Direct edits to `harness.yaml` can bypass the CLI, so core reads must validate through zod before use.
- Direct edits to `task.yaml` remain unrelated and must not become necessary for harness behavior.
- No MCP harness tool is added in this slice, so MCP HEAD fallback risk is limited to a regression check that existing MCP resolution remains explicit.

## Current Architecture

Verified flow:

```text
Human CLI
  -> command runner
  -> ActiveTaskResolver where human command semantics allow it
  -> PlaySpecCore
  -> task-scoped artifacts under .playspec/tasks/active/{taskId}/
```

Proposed harness flow:

```text
playspec harness attempt
  -> resolve active task
  -> PlaySpecCore.recordHarnessAttempt()
  -> load or initialize harness.yaml
  -> validate task/phase/result
  -> update attempt count and safety flags
  -> validate and write harness.yaml atomically
```

## Verified Behavior

- `YamlTaskStore.createTask()` creates task subdirectories but does not create `harness.yaml`.
- `PlaySpecCore` can compute an absolute task root from `TaskRecord.paths.taskRoot`.
- `TaskNotActiveError` exists and should be reused so harness commands operate only on active tasks.
- Path helpers in `src/utils/paths.ts` already centralize task and evolution artifact locations.
- CLI command registration is centralized in `src/cli/index.ts`.

## Problems

1. There is no persisted harness state for automated attempts.
2. Repeated failures cannot currently be represented as blocked/circuit state.
3. There is no command to inspect why automation should stop.
4. There is no reset audit event for human intervention.

## Proposed Direction

Add a small harness model:

- `HarnessAttemptResult`: `success | failure`
- `HarnessRecord`: task ID, phase ID, attempt count, retry budget, last result, last failure reason, blocked flag, circuit breaker flag, updated timestamp, and reset events.
- `HarnessResetEvent`: timestamp, task ID, previous blocked/circuit state, reason, and source.

Defaults:

- Missing `harness.yaml` returns a default record for the requested task/phase with `attemptCount: 0`, `retryBudget: 3`, `blocked: false`, and `circuitBreaker: false`.
- Failure increments `attemptCount`.
- When `attemptCount >= retryBudget`, set `blocked: true` and `circuitBreaker: true`.
- Success sets `lastResult: success`, clears `lastFailureReason`, `blocked`, and `circuitBreaker`, and preserves reset events.
- Reset appends a reset event and clears `blocked` and `circuitBreaker` without deleting `harness.yaml`.

## File-By-File Plan

- `src/core/types.ts`: add harness domain interfaces and result types.
- `src/core/schemas.ts`: add zod schemas for harness records and reset events.
- `src/utils/paths.ts`: add `getHarnessRecordPath()`.
- `src/core/errors.ts`: add narrow harness validation errors if needed.
- `src/core/playspec-core.ts`: add `getHarnessStatus`, `recordHarnessAttempt`, and `resetHarness` methods.
- `src/cli/commands/harness.ts`: add CLI runners and output formatting.
- `src/cli/index.ts`: register the `harness` command group.
- `tests/cli.test.ts`: cover command registration and user-visible attempt/reset output.
- `tests/integration/harness-store.test.ts`: cover retry budget, circuit breaker, reset event persistence, success behavior, and evidence preservation.
- `tests/integration/mcp-server.test.ts`: keep no-HEAD-fallback regression explicit.
- `docs/features/playspec_update_7_automation_safety_harness/result.md`: record implementation and validation results after implementation.
- `docs/features/playspec_update_7_automation_safety_harness/pr.md`: prepare PR summary after validation.

## Risks And Open Questions

- Existing active task directories will not have `harness.yaml`; the default read path must handle that without mutation.
- The phase does not define a configurable retry budget command. This slice uses a schema default of 3 and records it in persisted harness state when mutation occurs.
- Optional MCP status is intentionally omitted to avoid expanding the MCP tool surface without a required user-facing need.

## Reader Aids

- Harness state is task-scoped safety metadata, not workflow phase history.
- Reset is not deletion. It records an audit event and clears safety blockers.
- This phase stops at safety state and CLI visibility; it does not run agents or generate proposals.
