# 20-add-safe-phase-recovery Implementation Plan

## Goal

Add CLI-only safe phase-pointer recovery for active tasks, anchored on the approved spec in `docs/features/20_add_safe_phase_recovery/spec.md`.

The implementation must let users move `task.currentPhase` backward or to a validated workflow phase without invoking completion, rollback, migration, MCP, artifact cleanup, or workspace file changes.

## Current Code Anchors

- `src/cli/index.ts` registers `phase <phaseId>` as render-only and has no `rewind` command.
- `src/cli/commands/phase.ts` resolves a task through `ActiveTaskResolver` and calls `PlaySpecCore.renderExplicitPhasePrompt()`.
- `src/cli/commands/complete.ts` is the current CLI state-advancing command and must not be reused for recovery because `PlaySpecCore.completePhase()` writes snapshots, evidence, review files, rollback metadata, `stateSync`, `phaseHistory`, `currentPhase`, `updatedAt`, and sometimes `status`.
- `src/core/playspec-core.ts` owns task lifecycle validation and persistence boundaries; it already has `assertTaskIsActive()` and `validateCurrentPhase()`.
- `src/workflow/phase-resolver.ts` validates explicit phase existence in `workflow.phases`, but does not require `workflow.phaseOrder` membership.
- `src/storage/yaml-task-store.ts` has `updateTask()` merge semantics that preserve omitted fields, but it currently persists through non-atomic `saveTask()`.
- `src/cli/commands/use.ts` contains the existing interactive selector and terminal restoration pattern for `phase --select`.
- `src/cli/cli-utils.ts` provides `isInteractiveCli()` and phase display helpers.

## Behavior Trace

### `playspec rewind`

1. Entry point: `src/cli/index.ts` registers `rewind [--steps <n>] [--task <taskId>] [--yes]`.
2. Resolution: `src/cli/commands/rewind.ts` uses `ActiveTaskResolver.resolveTask()` to resolve `--task` or interactive HEAD.
3. State read: load the task workflow with `WorkflowLoader`, read `task.currentPhase`, and find its index in `workflow.phaseOrder`.
4. Target calculation: subtract `steps` from the current index. Default interactive `steps` is `1`; non-interactive mode requires explicit `--steps`.
5. Validation: reject inactive tasks, `currentPhase === null`, invalid current phase, non-positive steps, and out-of-range rewinds before writing.
6. Confirmation: interactive mode prints task, current phase, target phase, mutation scope, preservation note, and `Proceed? [y/N]`. Cancellation returns without mutation.
7. Mutation: call `PlaySpecCore.setCurrentPhase(task.id, targetPhaseId)`.
8. Persistence: Core validates active task and target phase membership in both `workflow.phaseOrder` and `workflow.phases`, then calls `TaskStore.updateTask(taskId, { currentPhase: targetPhaseId })`.
9. Reset/clear: no history, evidence, snapshot, rollback, prompt, review, source, output, status, MCP session, or migration state is reset or cleared.
10. User-visible result: CLI prints previous and current phase labels; `playspec prompt`, `current-task`, `list-tasks`, and `get-task` naturally reflect the recovered `currentPhase`.

### `playspec phase --set <phaseId>`

1. Entry point: `src/cli/index.ts` changes `phase <phaseId>` to `phase [phaseId]` and adds `--set <phaseId>`, `--select`, `--task <id>`, and `--yes`.
2. Compatibility branch: positional `playspec phase <phaseId>` with no mutating option keeps the existing render-only path.
3. Ambiguity guard: positional phase ID combined with `--set` or `--select` fails before mutation. Do not add `phase set` or `phase select` subcommands.
4. Resolution and validation: `src/cli/commands/phase.ts` resolves task, loads workflow for labels/warnings, and validates the target through the shared Core mutation path.
5. Confirmation: interactive mode asks before mutation; non-interactive mode requires `--task`, explicit `--set`, and `--yes`.
6. Warning: CLI warns when the target is backward or skips forward by more than one ordered phase.
7. Mutation and propagation: same `PlaySpecCore.setCurrentPhase()` to `TaskStore.updateTask()` flow as `rewind`.
8. User-visible result: success output shows previous and new phase; subsequent prompt/current/status displays read the updated task record.

### `playspec phase --select`

1. Entry point: same `phase [phaseId]` command, option branch for `--select`.
2. Mode guard: fail in non-interactive mode before selector display.
3. Selector: list `workflow.phaseOrder` phases with display labels from `phaseDisplayInfo()`, preselecting the current phase when it is valid.
4. Cancellation: Esc/Ctrl+C exits with `Cancelled. Phase not changed.` and no write.
5. Confirmation and mutation: selected phase goes through the same confirmation and `PlaySpecCore.setCurrentPhase()` path as `--set`.

## Ordered Implementation Steps

1. Add Core recovery mutation.
   - Edit `src/core/types.ts` if useful to add a small result type such as `SetCurrentPhaseResult`.
   - Edit `src/core/playspec-core.ts` to add `setCurrentPhase(taskId, targetPhaseId)`.
   - Reuse `assertTaskIsActive(task)`.
   - Load the workflow with the existing `WorkflowLoader`.
   - Validate `targetPhaseId` is in `workflow.phaseOrder` and has a `workflow.phases[targetPhaseId]` definition.
   - Persist only `{ currentPhase: targetPhaseId }` through `taskStore.updateTask()`.
   - Return `taskId`, `previousPhase`, and `currentPhase`.

2. Add focused recovery errors.
   - Edit `src/core/errors.ts`.
   - Reuse `InvalidCurrentPhaseError` where it already gives allowed values.
   - Add only narrow `PlaySpecError` subclasses if needed for invalid recovery target, invalid rewind steps, no explicit phase pointer, and rewind out of range.
   - Error messages must make no-write failures clear.

3. Make generic task updates atomic before recovery uses them.
   - Edit `src/storage/yaml-task-store.ts`.
   - Change `updateTask()` to parse the merged task with `TaskRecordSchema` and write `task.yaml` with `writeTextFileAtomic()`, matching the safety level of `completePhase()`.
   - Do not refactor `saveTask()` or unrelated creation/completion paths.
   - `src/storage/task-store.ts` should not need an interface change.

4. Register CLI commands and options.
   - Edit `src/cli/index.ts`.
   - Import `runRewind`.
   - Register `rewind` with `--steps <n>`, `--task <id>`, and `--yes`.
   - Change `phase <phaseId>` to `phase [phaseId]`.
   - Add `--set <phaseId>`, `--select`, `--task <id>`, and `--yes` to `phase`.
   - Keep all handlers using `handleError(err)`.

5. Implement `rewind`.
   - Add `src/cli/commands/rewind.ts`.
   - Parse `--steps` as a positive integer; reject `0`, negatives, decimals, and non-numeric values.
   - In non-interactive mode, require `--task`, explicit `--steps`, and `--yes`.
   - Resolve the task through `ActiveTaskResolver`.
   - Reject non-active tasks.
   - Load workflow, require non-null `task.currentPhase`, require current phase in `workflow.phaseOrder`, compute target, and reject out-of-range.
   - Ask confirmation with the required text in interactive mode.
   - Call `PlaySpecCore.setCurrentPhase()`.
   - Print concise success output.

6. Extend `phase` without breaking render-only behavior.
   - Edit `src/cli/commands/phase.ts`.
   - Keep existing positional render behavior when no mutating options are present.
   - Route `--set` and `--select` through a shared local mutation helper.
   - Reject positional phase ID plus `--set` or `--select`.
   - Reject `--set` plus `--select`.
   - Reject mutating non-interactive calls unless `--task`, explicit target, and `--yes` are present.
   - For `--select`, implement or reuse a selector following `src/cli/commands/use.ts` terminal restoration behavior.
   - Warn for backward moves and skip-forward moves based on `workflow.phaseOrder`.

7. Keep old and bypass paths isolated.
   - Do not change `src/cli/commands/complete.ts` behavior except tests that prove recovery is separate.
   - Do not add MCP recovery tools in `src/mcp/server.ts`.
   - Do not call `resolveMcpTaskId()` from CLI.
   - Do not change `src/cli/commands/rollback.ts`.
   - Do not change `src/migration/**`.
   - Do not change workflow or template presets.

8. Add tests.
   - Use existing CLI harnesses in `tests/cli.test.ts`, including `runCliInPty()` for confirmation and selector behavior.
   - Add Core/storage integration coverage in `tests/integration/completion-engine.test.ts` or a focused new integration test if it keeps the suite clearer.
   - Add storage atomic/preservation coverage in `tests/integration/task-store.test.ts` if not covered through Core tests.

9. Validate.
   - Run `pnpm test`.
   - Run `pnpm build`.
   - Inspect `git diff` to confirm changes are limited to the planned files and tests.

## Files To Edit

- `src/cli/index.ts`: register `rewind`; extend `phase` options while preserving positional render mode.
- `src/cli/commands/rewind.ts`: new command implementation.
- `src/cli/commands/phase.ts`: add `--set` and `--select` branches; keep `phase <phaseId>` render-only.
- `src/core/playspec-core.ts`: add validated `setCurrentPhase()` mutation.
- `src/core/errors.ts`: add or reuse controlled recovery errors.
- `src/core/types.ts`: optional result type for `setCurrentPhase()`.
- `src/storage/yaml-task-store.ts`: make `updateTask()` validate and write atomically.
- `tests/cli.test.ts`: end-to-end CLI coverage for rewind, phase set/select, confirmation, non-interactive safety, ambiguity, and preservation.
- `tests/integration/completion-engine.test.ts`: Core recovery mutation and no artifact/history side-effect coverage.
- `tests/integration/task-store.test.ts`: focused `updateTask()` preservation/validation coverage if needed.

## Tests To Add Or Update

- `rewind` success after `complete`: `currentPhase` moves from the second phase back to the first, `updatedAt` changes, and `phaseHistory` is unchanged.
- `rewind --steps 2`: target is computed from `workflow.phaseOrder`.
- Rewind rejects out-of-range steps without writing.
- Rewind rejects invalid `--steps` values without writing.
- Rewind rejects `currentPhase === null` with `Task has no explicit phase pointer yet.`
- Rewind rejects invalid current phase and prints allowed phase IDs.
- Rewind rejects inactive tasks.
- Interactive rewind cancellation writes nothing and prints cancellation.
- Non-interactive rewind rejects missing `--task`, missing explicit `--steps`, and missing `--yes`.
- Non-interactive `rewind --task <id> --steps <n> --yes` succeeds.
- `phase --set <phaseId>` succeeds for an active task and validates membership in both `workflow.phaseOrder` and `workflow.phases`.
- `phase --set` rejects invalid target without writing.
- `phase --set` warns on backward movement and skip-forward movement.
- `phase --set` rejects non-interactive mutation without `--task` or without `--yes`.
- `phase --select` fails in non-interactive mode.
- `phase --select` PTY test selects a phase, confirms, and mutates through the shared path.
- `phase --select` cancellation writes nothing.
- `playspec phase <phaseId>` still renders prompts and never mutates.
- `playspec phase set` and `playspec phase select` remain positional render-only requests, not mutating aliases.
- Ambiguous `playspec phase implementation --set focused_tests` fails without writing.
- Recovery does not create, delete, or rewrite evidence, snapshots, rollback records, prompts, reviews, outputs, or sources. Prefer comparing directory listings plus `task.yaml` fields before/after.
- `playspec complete` behavior remains unchanged: completion still writes history/artifacts and advances status at the final phase.

## Old Paths, Bypass Paths, And Partial Migration Risks

- Old path: manual editing of `.playspec/tasks/active/<taskId>/task.yaml` remains technically possible, but the new supported path must be CLI recovery.
- Old path: `playspec phase <phaseId>` is render-only and must not become mutating.
- Old state-advancing path: `playspec complete` and MCP `playspec_complete_phase` continue to call `PlaySpecCore.completePhase()` and keep their existing artifact/history side effects.
- Bypass path: direct `TaskStore.updateTask()` can still write arbitrary `currentPhase` if called elsewhere. This feature closes the CLI recovery path by validating in Core, not by broadening the storage schema.
- Bypass path: `playspec rollback` remains separate Git/task snapshot recovery and must not be invoked by rewind or phase set/select.
- Partial migration risk: no migration runner or schema changes are needed. Do not add a migration action type, archive behavior, or historical task mutation path.
- MCP risk: do not add MCP recovery APIs in this phase, and do not introduce any MCP read of `.playspec/HEAD`.

## Risks

- Command ambiguity around `phase`: avoid by using only option-based mutation and by rejecting positional-plus-mutating combinations.
- Unsafe non-interactive mutation: avoid by requiring `--task`, explicit target, and `--yes`.
- Partial writes: avoid by switching `YamlTaskStore.updateTask()` to `writeTextFileAtomic()` before recovery relies on it.
- Selector terminal state leaks: follow the `use` selector restoration pattern for success, cancel, and failure paths.
- Workflow inconsistency: reject targets absent from either `workflow.phaseOrder` or `workflow.phases`.
- Over-implementation: do not add history deletion, snapshot restoration, Git rollback, evidence cleanup, MCP APIs, migration behavior, viewer work, or DAG routing.

## Rollback Notes

- Revert the new CLI command registration and `src/cli/commands/rewind.ts` to remove the user-facing recovery entry point.
- Revert the `phase` option branches while preserving the original positional render command.
- Revert `PlaySpecCore.setCurrentPhase()` if recovery is removed.
- Keep the `YamlTaskStore.updateTask()` atomic write change unless it causes a concrete regression; it is a narrow persistence-safety improvement aligned with existing `completePhase()` behavior.
- No data migration rollback is required because the feature writes only existing task fields.

## Completion Criteria

- `playspec rewind`, `playspec rewind --steps <n>`, `playspec phase --set <phaseId>`, and `playspec phase --select` behave exactly as the spec describes.
- Every recovery mutation changes only `task.currentPhase` and `updatedAt` inside `task.yaml`.
- `phaseHistory`, `status`, `stateSync`, `rollback`, evidence, snapshots, prompts, reviews, outputs, sources, and workspace files are preserved.
- All cancellation and validation failures are no-write.
- Non-interactive mutation requires `--task`, explicit target, and `--yes`.
- Existing `playspec phase <phaseId>`, `playspec complete`, rollback, MCP, and migration behavior remains unchanged.
- `pnpm test` and `pnpm build` pass.
