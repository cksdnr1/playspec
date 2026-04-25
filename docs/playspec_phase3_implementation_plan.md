# PlaySpec Phase 3 Implementation Plan

## 1. Scope Boundary

Phase `3` is Reality Safety only. Implement:

- `StateDesyncDetector`
- persisted `stateSync.lastKnownGitHead` and completion timestamp
- rollback safe-point metadata
- changed/deleted/renamed/untracked file reporting since safe point
- severity calculation with warning-fatigue guardrails
- required `playspec next` pre-render sanity warning
- `playspec desync-check`
- `playspec rollback`, `rollback --state-only`, `rollback --git-only`, and `rollback --git-only --confirm`
- state-only rollback from a validated full task snapshot
- quarantine of future PlaySpec artifacts under `.playspec/tasks/.../rollback/`
- Git rollback preview and confirmed execution only when every safety gate passes

Do not implement MCP, archive/close, viewer, evolution, harness retry, stash creation, untracked deletion, SQLite, DAG execution, broad write-lock retrofit, or prompt context refresh workflows.

## 2. Code Evidence Summary

- Active CLI registration is centralized in `src/cli/index.ts`; commands are registered on `program` around the existing `next`, `phase`, `complete`, `evidence`, and `snapshot` registrations.
- Active `next` output path is `runNext()` in `src/cli/commands/next.ts`, which resolves a task, constructs `PlaySpecCore`, calls `core.renderNextPrompt(task.id)`, prints the prompt, then optionally writes a prompt file.
- Explicit phase render is `runPhase()` in `src/cli/commands/phase.ts`; it calls `core.renderExplicitPhasePrompt(task.id, phaseId)` and remains an optional warning path, not the Phase `3` required warning path.
- Active completion path is `runComplete()` -> `PlaySpecCore.completePhase()` -> `TaskStore.completePhase()` -> `YamlTaskStore.completePhase()`.
- Current state owner is `YamlTaskStore`; it validates through `TaskRecordSchema` and writes `task.yaml`.
- Current atomic completion mutation is `YamlTaskStore.completePhase()`, but it only updates `status`, `currentPhase`, `updatedAt`, and `phaseHistory`.
- Current artifact creation lives in `PlaySpecCore.writeSnapshots()`, `writeEvidence()`, and `writeReview()`.
- Current Git shell-out is private `PlaySpecCore.runGit()`, used only for evidence; Phase `3` should move shared Git operations into a Core helper/service rather than duplicate private logic in CLI.
- `TaskRecord` and `TaskRecordSchema` do not include `stateSync` or rollback fields.
- `StateDesyncDetector`, rollback manager, `desync-check` command, and `rollback` command do not exist.
- Existing tests already create temp workspaces and real Git repos, so Phase `3` can be tested without touching the repository root.

## 3. Minimal Verified File Set

Must read/edit:

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/errors.ts`
- `src/core/playspec-core.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/index.ts`
- `src/cli/commands/next.ts`
- `src/utils/fs.ts`
- `src/utils/paths.ts`
- `tests/cli.test.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/task-store.test.ts`

Expected new files anchored from existing code:

- `src/core/state-desync-detector.ts`, anchored by `PlaySpecCore` constructor and new `PlaySpecCore.checkTaskDesync(taskId)`.
- `src/core/rollback-manager.ts`, anchored by `PlaySpecCore` constructor and new `PlaySpecCore.planRollback()` / rollback methods.
- `src/core/git-state.ts` or equivalent Core-local helper, anchored by existing private `PlaySpecCore.runGit()`.
- `src/cli/commands/desync-check.ts`, anchored by `src/cli/index.ts` command registration pattern.
- `src/cli/commands/rollback.ts`, anchored by `src/cli/index.ts` command registration pattern.

Maybe read/edit:

- `src/cli/commands/phase.ts` only if implementing optional warning.
- `src/cli/commands/evidence.ts` and `src/cli/commands/snapshot.ts` only for output wording consistency.
- `src/core/index.ts` if new Core services/results need public package exports.

Ignore for this phase:

- `src/template/**`
- `src/workflow/**` except to read `PhaseDefinition.outputs` for target file checks
- `src/preset/**`
- `src/core/session-resolver.ts`
- MCP/archive/viewer/evolution/harness/DAG paths

## 4. Current Code Reality

- Current active entry point: `src/cli/index.ts` registers commands, then `program.parse(process.argv)`.
- Current state owner: `YamlTaskStore` owns task YAML reads/writes through `getTask()`, `saveTask()`, `updateTask()`, and `completePhase()`.
- Current data/update path: `runComplete()` resolves a task, calls `PlaySpecCore.completePhase()`, and `YamlTaskStore.completePhase()` performs the final atomic YAML write.
- Current propagation path: `TaskRecord` types in `src/core/types.ts` feed zod schemas in `src/core/schemas.ts`; `YamlTaskStore.getTask()` validates every loaded task through `TaskRecordSchema`.
- Current success/failure return path: CLI commands print success to stdout and `src/cli/index.ts::handleError()` prints `PlaySpecError` details to stderr before exiting `1`.
- Current cleanup/reset/lifetime path: `withWriteLock()` in `src/utils/fs.ts` guards completion/evidence/snapshot writes; temp tests clean workspaces through `createTempWorkspace().cleanup()`.
- Current observable output path: `runNext()` prints prompt to stdout; `runComplete()` prints completed phase and artifact files; evidence/snapshot commands print artifact paths.
- Stale/bypass paths: `PlaySpecCore.renderNextPrompt()` and `renderExplicitPhasePrompt()` are unchecked raw render primitives. `runPhase()` bypasses desync by design for Phase `3`. `next --write` writes prompt files outside the task write lock. Manual evidence/snapshot artifacts are passive and do not prove desync detection.

## 5. Required Change List

1. Extend task types and zod schema with optional `stateSync` and `rollback` metadata.
2. Extend `CompletePhaseInput` so completion can pass `stateSync` and rollback safe-point metadata into the single atomic `TaskStore.completePhase()` mutation.
3. Update `YamlTaskStore.createTask()` to write normalized optional metadata for new tasks, while schema remains backward compatible for old task YAML.
4. Update `YamlTaskStore.completePhase()` to atomically persist phase completion, `stateSync`, and rollback metadata together.
5. Extract or add Core-local Git state collection so desync and rollback do not depend on CLI.
6. Add `StateDesyncDetector` with deterministic severity rules.
7. Add `PlaySpecCore.checkTaskDesync(taskId)` and wire `runNext()` to call it before `renderNextPrompt()`.
8. Add `desync-check` CLI command and registration.
9. Add rollback plan/state-only/Git preview/confirmed execution Core APIs.
10. Add `rollback` CLI command and registration.
11. Add artifact quarantine for state-only rollback.
12. Add explicit user-recovery errors.
13. Add positive, negative, lifecycle, bypass-prevention, and reviewer-demo tests.

## 6. Ordered Patch Plan

### Step P1 — Extend Task Metadata Contracts

- Target file: `src/core/types.ts`
- Target class/function: `TaskRecord`, `CompletePhaseInput`, new result interfaces
- Existing code anchor: `TaskRecord` currently ends with `phaseHistory: PhaseHistoryEntry[]`; `CompletePhaseInput` currently carries `phaseId`, `nextPhase`, review/evidence/snapshot fields.
- Exact change intent: Add optional `TaskStateSync`, `TaskRollbackState`, `RollbackSafePoint`, `DesyncCheckResult`, `RollbackPlanResult`, `RollbackExecutionResult`, and extend `TaskRecord` / `CompletePhaseInput` with optional sync and safe-point metadata.
- Data/control-flow effect: Core can pass one complete completion-state update to the store; CLI can print structured desync/rollback results.
- Observable result: After `complete`, loaded `task.yaml` can include `stateSync.lastKnownGitHead`, `stateSync.lastCompletedAt`, and `rollback.lastSafePoint`.
- Risk or guardrail: Keep new `TaskRecord` fields optional so existing task YAML remains readable.
- Out-of-phase warning: Do not add archive/evolution/harness fields.

### Step P2 — Extend Zod Schemas Backward-Compatibly

- Target file: `src/core/schemas.ts`
- Target class/function: `TaskRecordSchema`, new nested schemas
- Existing code anchor: `TaskRecordSchema` currently validates fields through `phaseHistory: z.array(PhaseHistoryEntrySchema)`.
- Exact change intent: Add optional nested schemas for `stateSync` and `rollback`; accept nullable safe point fields; keep all new top-level fields optional.
- Data/control-flow effect: `YamlTaskStore.getTask()` can parse both old and new task YAML.
- Observable result: Tests can load a pre-Phase-3 task without `stateSync` and a new task with rollback metadata.
- Risk or guardrail: Do not make newly introduced fields required in zod.
- Out-of-phase warning: Do not weaken validation with passthrough for unrelated unknown structures.

### Step P3 — Preserve Metadata in Atomic Completion Writes

- Target file: `src/storage/task-store.ts`
- Target class/function: `TaskStore.completePhase()`
- Existing code anchor: Interface method `completePhase(taskId: string, input: CompletePhaseInput): Promise<TaskRecord>`.
- Exact change intent: Reuse the method but extend `CompletePhaseInput`; do not add a second update method for sync metadata.
- Data/control-flow effect: Completion remains one store call from Core to storage.
- Observable result: No split write exists between phase completion and sync/safe-point metadata.
- Risk or guardrail: Do not route completion metadata through generic `updateTask()`.
- Out-of-phase warning: Do not broaden the store interface for archive/SQLite.

### Step P4 — Normalize New Tasks and Atomic Completion Metadata

- Target file: `src/storage/yaml-task-store.ts`
- Target class/function: `YamlTaskStore.createTask()`, `YamlTaskStore.completePhase()`, `YamlTaskStore.buildPhaseHistory()`
- Existing code anchor: `createTask()` builds the initial `task` object before writing `task.yaml`; `completePhase()` builds `updated` then validates and calls `writeTextFileAtomic()`.
- Exact change intent: Initialize normalized `stateSync`/`rollback` for new tasks if desired; in `completePhase()`, merge input sync/safe-point metadata into the same `updated` object that updates status/currentPhase/history.
- Data/control-flow effect: `TaskRecordSchema.parse(updated)` validates the whole final task before the existing atomic write.
- Observable result: `task.yaml` changes once for completion and includes both phase history and safe-point metadata.
- Risk or guardrail: Keep `buildPhaseHistory()` focused on phase history; do not make it own rollback metadata.
- Out-of-phase warning: Do not retrofit locking for `createTask()` or `updateTask()` beyond existing behavior.

### Step P5 — Add Core Git State Helper

- Target file: new `src/core/git-state.ts`
- Target class/function: new helper functions or class, anchored from `PlaySpecCore.runGit()`
- Existing code anchor: `PlaySpecCore.writeEvidence()` calls private `runGit()` for `status`, `diff --stat`, and `status --porcelain`; `runGit()` sets `cwd: this.workspaceRoot`.
- Exact change intent: Move shared Git reads to a Core-local helper that can return current HEAD, branch/status, porcelain entries including rename/delete/untracked, and diff stats since safe point. Keep `execa`.
- Data/control-flow effect: `StateDesyncDetector`, rollback manager, and evidence can use consistent Git state collection without CLI dependencies.
- Observable result: `desync-check` and rollback plan report the same changed/deleted/renamed/untracked file categories.
- Risk or guardrail: Keep helper under `src/core`; do not import CLI from Core; do not introduce global HEAD task resolution.
- Out-of-phase warning: Do not implement stash, pull, branch switching, or untracked deletion.

### Step P6 — Add StateDesyncDetector

- Target file: new `src/core/state-desync-detector.ts`
- Target class/function: `StateDesyncDetector.run(task: TaskRecord): Promise<DesyncCheckResult>`
- Existing code anchor: `PlaySpecCore` constructor currently initializes Core services; add detector there and expose it through a new Core method.
- Exact change intent: Compare `task.stateSync.lastKnownGitHead` / rollback safe point against current Git state; classify `none | low | medium | high`; include changed/deleted/renamed/untracked arrays, reasons, and recommended action.
- Data/control-flow effect: Core can answer desync status for an explicit task ID without rendering.
- Observable result: `playspec desync-check` prints severity and file lists; `playspec next` can warn before prompt text.
- Risk or guardrail: Ordinary uncommitted tracked source changes are `medium` by default, not `high`; `high` is for Git HEAD change, target/phase output deletion/rename, or heavy `projectDocRoot` change.
- Out-of-phase warning: Do not implement interactive refresh/sync snapshot workflows.

### Step P7 — Add Core Desync API

- Target file: `src/core/playspec-core.ts`
- Target class/function: `PlaySpecCore`, new `checkTaskDesync(taskId: string)`
- Existing code anchor: public methods `renderNextPrompt()`, `renderExplicitPhasePrompt()`, `completePhase()`, `collectEvidence()`, and `createSnapshot()` all load a task by explicit `taskId`.
- Exact change intent: Add `checkTaskDesync(taskId)` that loads the task and delegates to `StateDesyncDetector`; keep render methods unchecked.
- Data/control-flow effect: CLI and future MCP can share a checked Core API while raw render functions stay primitive.
- Observable result: Tests can call Core `checkTaskDesync()` directly and get structured severity.
- Risk or guardrail: Do not read `.playspec/HEAD` in Core.
- Out-of-phase warning: Do not make render methods prompt for input or block.

### Step P8 — Capture Safe Point During Completion

- Target file: `src/core/playspec-core.ts`
- Target class/function: `PlaySpecCore.completePhase()`, `writeSnapshots()`
- Existing code anchor: Inside `completePhase()`, after `writeSnapshots()`/`writeEvidence()`/optional `writeReview()`, Core computes `nextPhase` and calls `this.taskStore.completePhase(taskId, { ... })`.
- Exact change intent: Collect current Git HEAD before the store call; build rollback safe-point metadata pointing at the completion task snapshot and prompt snapshot; include sync/safe-point fields in the existing `completePhase()` input.
- Data/control-flow effect: The same locked completion callback creates artifacts and persists the safe-point reference.
- Observable result: `task.yaml` after `complete` points to `snapshots/phaseX_before_complete.yaml` and stores the Git HEAD used by desync/rollback.
- Risk or guardrail: Use the pre-completion task snapshot already written by `writeSnapshots()`; do not create a second inconsistent snapshot after state mutation.
- Out-of-phase warning: Do not generate evolution context or archive records.

### Step P9 — Wire `next` Warning

- Target file: `src/cli/commands/next.ts`
- Target class/function: `runNext()`
- Existing code anchor: After task active check and `const core = new PlaySpecCore(workspaceRoot, store)`, current code immediately calls `core.renderNextPrompt(task.id)`.
- Exact change intent: Call `core.checkTaskDesync(task.id)` before rendering; if severity is `high`, print a warning and recommendation before `console.log(prompt)`.
- Data/control-flow effect: `next` remains non-interactive and still renders unless an existing error occurs, but warning precedes prompt text.
- Observable result: `playspec next` output contains desync warning before rendered prompt when HEAD changed or target files were deleted/renamed.
- Risk or guardrail: Do not block forever for input; do not implement refresh options.
- Out-of-phase warning: Do not wire optional `phase` warning unless it is trivial and does not expand scope.

### Step P10 — Add `desync-check` CLI

- Target file: new `src/cli/commands/desync-check.ts`
- Target class/function: `runDesyncCheck(workspaceRoot, taskIdOption?)`
- Existing code anchor: Existing command files construct `YamlTaskStore`, `ActiveTaskResolver`, `PlaySpecCore`, call one Core method, and print stdout.
- Exact change intent: Resolve task with optional `--task`, call `core.checkTaskDesync(task.id)`, print task ID, severity, last/current Git HEAD, changed/deleted/renamed/untracked files, reasons, and recommended action.
- Data/control-flow effect: User can inspect drift without rendering a prompt.
- Observable result: `playspec desync-check` exits `0` and prints severity/file list in a temp Git workspace.
- Risk or guardrail: Keep formatting deterministic for tests.
- Out-of-phase warning: Do not add interactive menus.

### Step P11 — Register `desync-check` and `rollback`

- Target file: `src/cli/index.ts`
- Target class/function: `program` registrations
- Existing code anchor: Existing command registration blocks for `next`, `phase`, `complete`, `evidence`, and `snapshot`.
- Exact change intent: Import `runDesyncCheck` and `runRollback`; add command blocks with `--task`, rollback `--state-only`, `--git-only`, and `--confirm` options.
- Data/control-flow effect: Commander routes new commands through the existing `handleError()` pattern.
- Observable result: `playspec --help` lists `desync-check` and `rollback`; command failures print `PlaySpecError` hints.
- Risk or guardrail: Do not add MCP command aliases or archive flags.
- Out-of-phase warning: Do not add stash/cleanup flags.

### Step P12 — Add Rollback Manager

- Target file: new `src/core/rollback-manager.ts`
- Target class/function: `RollbackManager.plan()`, `rollbackStateOnly()`, `executeGitRollback()`
- Existing code anchor: `PlaySpecCore.completePhase()` and `YamlTaskStore.completePhase()` already define safe-point creation path; `withWriteLock()` and `writeTextFileAtomic()` define task mutation safety.
- Exact change intent: Implement a Core-level manager that loads the last safe point, computes a rollback plan, restores state-only snapshots under lock, quarantines future PlaySpec artifacts, and executes Git rollback only for `--confirm` when gates pass.
- Data/control-flow effect: Rollback behavior stays Core-owned and task-explicit; CLI only chooses mode and prints result.
- Observable result: `rollback --state-only` changes `task.yaml` and `.playspec` artifacts only; `rollback --git-only` previews; `rollback --git-only --confirm` executes only when clean and safe.
- Risk or guardrail: Never delete untracked files; never mutate Git on dirty tree, new commit, or branch divergence; validate restored snapshot before writing.
- Out-of-phase warning: Do not archive rollback history outside the task folder or introduce viewer timelines.

### Step P13 — Add Core Rollback APIs

- Target file: `src/core/playspec-core.ts`
- Target class/function: `PlaySpecCore.planRollback()`, `rollbackStateOnly()`, `executeGitRollback()`
- Existing code anchor: Public Core methods already load tasks by explicit `taskId` and delegate to helpers.
- Exact change intent: Add task-explicit wrapper methods around `RollbackManager`; pass `workspaceRoot` and `taskStore`.
- Data/control-flow effect: CLI and future MCP use the same Core rollback behavior without CLI state fallback.
- Observable result: Tests can exercise Core rollback without invoking CLI.
- Risk or guardrail: Do not let Core resolve `.playspec/HEAD`.
- Out-of-phase warning: Do not expose MCP tool objects.

### Step P14 — Add Rollback CLI

- Target file: new `src/cli/commands/rollback.ts`
- Target class/function: `runRollback(workspaceRoot, options)`
- Existing code anchor: `runComplete()` and `runEvidence()` show the current pattern for resolve task -> Core call -> stdout.
- Exact change intent: Resolve task; if `--state-only`, call Core state rollback; if `--git-only`, call plan or confirmed execution depending on `--confirm`; default command prints the safest available option/plan.
- Data/control-flow effect: CLI mode selection stays outside Core; Core owns safety gates.
- Observable result: Dirty tree rollback command prints blocked mutation and state-only recommendation; clean confirmed command reports executed plan.
- Risk or guardrail: Reject ambiguous `--state-only --git-only` combinations with a clear error.
- Out-of-phase warning: Do not prompt for interactive confirmation; `--confirm` is the explicit non-interactive confirmation.

### Step P15 — Add Artifact Quarantine Helpers

- Target file: `src/utils/fs.ts` and/or `src/core/rollback-manager.ts`
- Target class/function: existing `writeTextFileAtomic()` / `withWriteLock()` anchor for safe filesystem mutation
- Existing code anchor: `fs.ts` already imports `mkdir`, `rename`, and `rm`; rollback can use `rename` under the existing task write lock.
- Exact change intent: Move future PlaySpec artifacts created after the target safe point from active `prompts/`, `reviews/`, `evidence/`, and `snapshots/` paths into `rollback/<safePointId>/...`; do not touch project files outside `.playspec`.
- Data/control-flow effect: State-only rollback leaves active task folder coherent while preserving artifacts for inspection.
- Observable result: After `rollback --state-only`, future artifact files no longer appear in active folders and can be found under rollback quarantine.
- Risk or guardrail: Use path checks rooted at the task root; never delete files outside `.playspec`.
- Out-of-phase warning: Do not implement archive retention or viewer metadata.

### Step P16 — Add User-Recovery Errors

- Target file: `src/core/errors.ts`
- Target class/function: new `PlaySpecError` subclasses
- Existing code anchor: Existing errors include `TaskNotActiveError` and `GitEvidenceCollectionError` with recovery hints used by CLI `handleError()`.
- Exact change intent: Add errors for no rollback safe point, desync Git unavailable, unsafe Git rollback blocked, rollback snapshot missing/invalid, and invalid rollback option combination.
- Data/control-flow effect: CLI prints consistent error/hint output without ad hoc string exceptions.
- Observable result: Negative tests assert stderr contains actionable hints.
- Risk or guardrail: Do not create a large severity-specific error hierarchy.
- Out-of-phase warning: Do not add archive/evolution errors.

### Step P17 — Export Only Needed Core Surface

- Target file: `src/core/index.ts`
- Target class/function: barrel exports
- Existing code anchor: Current exports expose types, errors, schemas, `PlaySpecCore`, `ActiveTaskResolver`, and `SessionResolver`.
- Exact change intent: Export new result types through `types.ts`; export detector/rollback manager only if tests or downstream code need direct imports.
- Data/control-flow effect: Keeps module boundaries explicit.
- Observable result: TypeScript tests can import public result types if needed.
- Risk or guardrail: Prefer testing behavior through `PlaySpecCore` and CLI; avoid overexposing internals.
- Out-of-phase warning: Do not create MCP adapter exports.

### Step P18 — Add Phase 3 Tests

- Target file: `tests/integration/completion-engine.test.ts`, `tests/cli.test.ts`, `tests/integration/task-store.test.ts`, plus optional new `tests/integration/reality-safety.test.ts`
- Target class/function: existing test helpers and `runCli()` patterns
- Existing code anchor: `initWorkspaceWithTask()` creates Git repos; `runCli()` executes `tsx src/cli/index.ts`; existing tests assert artifact presence and CLI stdout/stderr.
- Exact change intent: Add observable tests listed in section 13.
- Data/control-flow effect: Tests prove end-to-end behavior, not only DTO/schema existence.
- Observable result: `pnpm test` proves desync warnings, rollback safety gates, state restore, and artifact quarantine.
- Risk or guardrail: Use temp workspaces only; never operate on repo root.
- Out-of-phase warning: Do not test MCP/archive/viewer/evolution.

## 7. Per-File Change Plan

- File path: `src/core/types.ts`
- Reason for change: Add Phase `3` data contracts.
- Existing anchors: `TaskRecord`, `CompletePhaseInput`, `CompletionResult`.
- Functions/classes to edit: interfaces/types only.
- Functions/classes not to edit: none.
- Existing DTOs/interfaces/contracts to reuse: `TaskId`, `PhaseId`, `TaskRecord`, `CompletePhaseInput`.
- Expected compile impact: New type fields referenced by store/Core/CLI.
- Expected behavior impact: Allows persisted sync and rollback metadata.
- Architecture guardrail: Keep data contracts in Core, not CLI.

- File path: `src/core/schemas.ts`
- Reason for change: Validate new task metadata.
- Existing anchors: `TaskRecordSchema`, `PhaseHistoryEntrySchema`.
- Functions/classes to edit: schema constants.
- Functions/classes not to edit: workflow/session schemas unless needed by type references.
- Existing DTOs/interfaces/contracts to reuse: zod validation pattern.
- Expected compile impact: Store validation accepts new fields.
- Expected behavior impact: Old task YAML loads; new task YAML persists metadata.
- Architecture guardrail: Do not use schema passthrough as a shortcut.

- File path: `src/storage/task-store.ts`
- Reason for change: Atomic completion input must carry metadata.
- Existing anchors: `TaskStore.completePhase()`.
- Functions/classes to edit: interface import/types only.
- Functions/classes not to edit: create/list/update signatures unless absolutely required.
- Existing DTOs/interfaces/contracts to reuse: `CompletePhaseInput`.
- Expected compile impact: Implementations compile after `CompletePhaseInput` expands.
- Expected behavior impact: No second completion metadata write required.
- Architecture guardrail: Store remains abstract; no Core concrete service leakage.

- File path: `src/storage/yaml-task-store.ts`
- Reason for change: Persist metadata and restore validated task records.
- Existing anchors: `createTask()`, `completePhase()`, `buildPhaseHistory()`, `saveTask()`.
- Functions/classes to edit: `createTask()`, `completePhase()`; add a task replacement method only if rollback cannot safely use `saveTask()` under Core-held lock.
- Functions/classes not to edit: `listActiveTasks()` except if summary must include no new fields.
- Existing DTOs/interfaces/contracts to reuse: `TaskRecordSchema`, `writeTextFileAtomic()`.
- Expected compile impact: Imports for rollback/sync types may be added.
- Expected behavior impact: Completion writes safe point and sync metadata atomically.
- Architecture guardrail: Do not make storage call Git.

- File path: `src/core/playspec-core.ts`
- Reason for change: Add explicit-task Core APIs and completion safe-point integration.
- Existing anchors: constructor service initialization, `renderNextPrompt()`, `completePhase()`, `writeSnapshots()`, `writeEvidence()`, `runGit()`.
- Functions/classes to edit: `PlaySpecCore` constructor, add `checkTaskDesync()`, `planRollback()`, `rollbackStateOnly()`, `executeGitRollback()`, update `completePhase()`.
- Functions/classes not to edit: `renderResolvedPhase()` behavior; raw render methods stay unchecked.
- Existing DTOs/interfaces/contracts to reuse: `TaskStore`, `TaskRecord`, `CompletionResult`, `withWriteLock()`.
- Expected compile impact: New imports for detector/manager/git helper/result types.
- Expected behavior impact: Core exposes desync and rollback without HEAD fallback.
- Architecture guardrail: Core must never read `.playspec/HEAD`.

- File path: `src/core/git-state.ts` (new)
- Reason for change: Shared Git state collection.
- Existing anchors: `PlaySpecCore.runGit()` and evidence Git command usage.
- Functions/classes to edit: new Core helper.
- Functions/classes not to edit: CLI commands.
- Existing DTOs/interfaces/contracts to reuse: `TaskRecord.paths` for project doc root.
- Expected compile impact: New Core import paths.
- Expected behavior impact: Consistent Git data for evidence/desync/rollback.
- Architecture guardrail: Keep `execa` calls local to Core helper; no CLI dependency.

- File path: `src/core/state-desync-detector.ts` (new)
- Reason for change: Implement desync severity and file classification.
- Existing anchors: `PlaySpecCore.checkTaskDesync()` integration point.
- Functions/classes to edit: new detector.
- Functions/classes not to edit: template/workflow renderers.
- Existing DTOs/interfaces/contracts to reuse: `TaskRecord`, `PhaseDefinition.outputs` if loaded by Core, `DesyncCheckResult`.
- Expected compile impact: New Core service import.
- Expected behavior impact: Produces observable severity and reasons.
- Architecture guardrail: No CLI output formatting in detector.

- File path: `src/core/rollback-manager.ts` (new)
- Reason for change: Implement rollback planning/execution.
- Existing anchors: completion safe point metadata and `withWriteLock()` usage.
- Functions/classes to edit: new rollback manager.
- Functions/classes not to edit: session resolver.
- Existing DTOs/interfaces/contracts to reuse: `TaskRecord`, `RollbackSafePoint`, `RollbackPlanResult`, `TaskRecordSchema`.
- Expected compile impact: New imports in `PlaySpecCore`.
- Expected behavior impact: Provides state-only restore, artifact quarantine, Git preview/confirm gates.
- Architecture guardrail: No HEAD fallback and no untracked deletion.

- File path: `src/core/errors.ts`
- Reason for change: Consistent CLI recovery hints.
- Existing anchors: `PlaySpecError`, `GitEvidenceCollectionError`, `TaskNotActiveError`.
- Functions/classes to edit: add error subclasses.
- Functions/classes not to edit: existing error messages unless needed for tests.
- Existing DTOs/interfaces/contracts to reuse: `PlaySpecError`.
- Expected compile impact: New imports where thrown.
- Expected behavior impact: Safer failure messages.
- Architecture guardrail: Keep errors generic and user-actionable.

- File path: `src/cli/commands/next.ts`
- Reason for change: Required warning before prompt output.
- Existing anchors: `runNext()` after Core construction and before `renderNextPrompt()`.
- Functions/classes to edit: `runNext()`.
- Functions/classes not to edit: write path unless warning output changes placement.
- Existing DTOs/interfaces/contracts to reuse: `DesyncCheckResult` from Core types if formatting helper is typed.
- Expected compile impact: Calls new Core method.
- Expected behavior impact: High desync warning appears before prompt.
- Architecture guardrail: CLI formats output; Core computes facts.

- File path: `src/cli/commands/desync-check.ts` (new)
- Reason for change: User-facing inspection path.
- Existing anchors: `runEvidence()` and `runSnapshot()` command pattern.
- Functions/classes to edit: new `runDesyncCheck()`.
- Functions/classes not to edit: evidence/snapshot commands.
- Existing DTOs/interfaces/contracts to reuse: `YamlTaskStore`, `ActiveTaskResolver`, `PlaySpecCore`.
- Expected compile impact: Imported by CLI index.
- Expected behavior impact: `playspec desync-check` prints drift.
- Architecture guardrail: No Git shell-out in CLI.

- File path: `src/cli/commands/rollback.ts` (new)
- Reason for change: User-facing recovery path.
- Existing anchors: `runComplete()` command pattern.
- Functions/classes to edit: new `runRollback()`.
- Functions/classes not to edit: `runUse()` or session code.
- Existing DTOs/interfaces/contracts to reuse: `YamlTaskStore`, `ActiveTaskResolver`, `PlaySpecCore`.
- Expected compile impact: Imported by CLI index.
- Expected behavior impact: Rollback modes are observable from CLI.
- Architecture guardrail: CLI does not implement safety gates; it passes flags to Core.

- File path: `src/cli/index.ts`
- Reason for change: Register new commands and flags.
- Existing anchors: `program.command('next')`, `program.command('complete')`, `program.command('snapshot')`.
- Functions/classes to edit: imports and command registration blocks.
- Functions/classes not to edit: `handleError()`, existing command behavior.
- Existing DTOs/interfaces/contracts to reuse: commander pattern and `handleError()`.
- Expected compile impact: New imports.
- Expected behavior impact: `--help` and command dispatch include Phase `3` commands.
- Architecture guardrail: Do not add later-phase commands.

- File path: `src/utils/fs.ts`
- Reason for change: Possible shared safe move/quarantine helper.
- Existing anchors: imports include `mkdir`, `rename`, `rm`; `writeTextFileAtomic()` already uses safe rename.
- Functions/classes to edit: add helper only if rollback manager needs reusable path-safe move.
- Functions/classes not to edit: `withWriteLock()` behavior.
- Existing DTOs/interfaces/contracts to reuse: existing promise-based fs helper style.
- Expected compile impact: Optional new export from `src/utils/index.ts`.
- Expected behavior impact: Artifact quarantine is less ad hoc.
- Architecture guardrail: Helper must not know task semantics.

- File path: `tests/cli.test.ts`
- Reason for change: CLI observable behavior tests.
- Existing anchors: `runCli()`, `createActiveTask()`, `initGitRepo()`, current CLI tests.
- Functions/classes to edit: add tests.
- Functions/classes not to edit: existing Phase 1/2 assertions unless output ordering changes.
- Existing DTOs/interfaces/contracts to reuse: temp workspace helpers.
- Expected compile impact: none beyond new imports.
- Expected behavior impact: Ensures commands work through real CLI.
- Architecture guardrail: Use temp workspace only.

- File path: `tests/integration/completion-engine.test.ts`
- Reason for change: Core completion/safe-point and lock behavior tests.
- Existing anchors: `initWorkspaceWithTask()`, completion tests, lock test.
- Functions/classes to edit: add tests for `stateSync` and rollback safe point after complete.
- Functions/classes not to edit: existing Phase `2` tests except expected task metadata expansion.
- Existing DTOs/interfaces/contracts to reuse: `PlaySpecCore`, `YamlTaskStore`.
- Expected compile impact: none beyond new fields.
- Expected behavior impact: Proves completion metadata is end-to-end observable.
- Architecture guardrail: Do not assert only DTO existence.

- File path: `tests/integration/task-store.test.ts`
- Reason for change: Schema/store backward compatibility.
- Existing anchors: `YamlTaskStore` create/read/update tests.
- Functions/classes to edit: add old YAML load or schema validation test; add create normalized metadata test if implemented.
- Functions/classes not to edit: list/update unrelated tests.
- Existing DTOs/interfaces/contracts to reuse: `YamlTaskStore`.
- Expected compile impact: none.
- Expected behavior impact: Old tasks remain readable.
- Architecture guardrail: Do not require new fields in old task YAML.

## 8. Active Entry Point and Call Flow

Required `next` flow:

```text
src/cli/index.ts
-> program.command('next')
-> runNext()
-> ActiveTaskResolver.resolveTask(taskIdOption)
-> PlaySpecCore.checkTaskDesync(task.id)
-> print warning if severity high
-> PlaySpecCore.renderNextPrompt(task.id)
-> console.log(prompt)
-> optional prompt file write
```

Required completion flow:

```text
src/cli/index.ts
-> program.command('complete')
-> runComplete()
-> PlaySpecCore.completePhase(task.id)
-> withWriteLock(taskRoot)
-> writeSnapshots/writeEvidence/writeReview
-> collect current Git HEAD
-> TaskStore.completePhase(taskId, input with stateSync + rollback safe point)
-> YamlTaskStore.completePhase()
-> TaskRecordSchema.parse(updated)
-> writeTextFileAtomic(task.yaml)
```

Required `desync-check` flow:

```text
src/cli/index.ts
-> program.command('desync-check')
-> runDesyncCheck()
-> ActiveTaskResolver.resolveTask(taskIdOption)
-> PlaySpecCore.checkTaskDesync(task.id)
-> print structured result
```

Required rollback flow:

```text
src/cli/index.ts
-> program.command('rollback')
-> runRollback()
-> ActiveTaskResolver.resolveTask(taskIdOption)
-> PlaySpecCore.planRollback(task.id)
-> mode state-only: PlaySpecCore.rollbackStateOnly(task.id)
-> mode git-only preview: print plan and confirm command if eligible
-> mode git-only confirm: PlaySpecCore.executeGitRollback(task.id)
```

## 9. Data/State Flow

- `TaskRecord.stateSync.lastKnownGitHead` is written on successful completion from current Git HEAD.
- `TaskRecord.stateSync.lastCompletedAt` is written in the same atomic completion mutation as phase history.
- `TaskRecord.rollback.lastSafePoint` points to the completion task snapshot and optional prompt snapshot.
- Desync checks load the task through `TaskStore.getTask()`, read `stateSync`, collect current Git state, and return a result without mutating task state.
- `next` consumes the desync result for warning output only.
- State-only rollback loads `rollback.lastSafePoint.taskSnapshotFile`, validates the snapshot as `TaskRecord`, quarantines future PlaySpec artifacts, then writes restored state atomically.
- Git rollback preview computes affected files/commits without mutation.
- Git rollback confirm reuses the plan and mutates Git only after clean-tree, no-new-commit, no-divergence, and no-untracked-deletion gates pass.

## 10. Ownership and Lifetime Safety

- CLI owns task ID fallback via `ActiveTaskResolver`; Core receives explicit task IDs only.
- Core owns desync and rollback semantics.
- Storage owns YAML validation and persistence.
- `withWriteLock(taskRoot)` must guard completion metadata writes and state-only rollback mutation/quarantine.
- Artifact quarantine must only move files under `getTaskRoot(workspaceRoot, task.id)`.
- Git mutation must never run when the working tree is dirty, when commits advanced after safe point, when branch/pull divergence is detected, or when untracked deletion would be required.
- Test workspaces are created by `createTempWorkspace()` outside the repo root and cleaned after each test.

## 11. Bypass/Old-Path Containment

- `PlaySpecCore.renderNextPrompt()` and `renderExplicitPhasePrompt()` remain unchecked primitives. Do not claim they perform desync safety.
- Required safety path is `PlaySpecCore.checkTaskDesync(taskId)` plus `runNext()` pre-render call.
- `playspec phase` warning is optional in Phase `3`; if not implemented, document/test only `next` as required.
- `playspec complete` high-desync warning is optional and non-blocking; completion metadata write is required.
- `next --write` remains outside the task write lock; do not widen the phase to fix it unless the new desync check writes state there.
- Manual `evidence` and `snapshot` commands create passive artifacts; do not count them as desync detector or rollback implementation.
- Existing `create`, `use`, and preset init unlocked paths remain old paths; do not retrofit.

## 12. Architecture Safety Notes

- Use path aliases for cross-module imports: `#core/*.js`, `#storage/*.js`, `#utils/*.js`.
- CLI may depend on Core and Storage; Core must not depend on CLI.
- Storage must not shell out to Git.
- Core must not resolve global `.playspec/HEAD`; only CLI does that through `ActiveTaskResolver`.
- New services should be Core-local and injected/constructed by `PlaySpecCore`.
- Do not pass concrete `YamlTaskStore` into Core-only helpers; depend on `TaskStore`.
- Do not change `tsconfig`, package boundaries, or build scripts to bypass import errors.

## 13. Test and Demo Plan

### Positive Tests

- Entry point: `PlaySpecCore.completePhase()`
- Setup: temp workspace, default preset, active task, Git init/commit using existing `initWorkspaceWithTask()` pattern.
- Action: call `core.completePhase(taskId)`.
- Expected observable result: loaded `task.yaml` has `stateSync.lastKnownGitHead`, `stateSync.lastCompletedAt`, and `rollback.lastSafePoint.taskSnapshotFile`; phase history still advances.
- Why this proves Phase `3`: safe point and sync metadata are observable on the active completion path.

- Entry point: `playspec desync-check`
- Setup: complete a phase, modify a tracked file without committing.
- Action: run CLI `desync-check`.
- Expected observable result: exit `0`, severity is `medium`, changed file is listed, no high warning language.
- Why this proves Phase `3`: demonstrates warning-fatigue rule for normal uncommitted work.

- Entry point: `playspec next`
- Setup: complete a phase, create a new commit or delete/rename a target file.
- Action: run CLI `next`.
- Expected observable result: warning appears before rendered prompt; prompt still renders.
- Why this proves Phase `3`: required pre-render warning path is observable.

- Entry point: `playspec rollback --state-only`
- Setup: complete phase 1, complete or advance later phase, create later prompt/evidence/review artifacts.
- Action: run CLI rollback state-only.
- Expected observable result: `task.yaml` restored from validated safe-point snapshot; project source files unchanged; future artifacts moved under `rollback/`.
- Why this proves Phase `3`: verifies coherent state rollback and artifact ghost prevention.

- Entry point: `playspec rollback --git-only`
- Setup: safe point exists, clean workspace.
- Action: run preview command.
- Expected observable result: prints affected files/commits and exact `--confirm` command when eligible; no mutation occurs.
- Why this proves Phase `3`: preview is observable and non-mutating.

- Entry point: `playspec rollback --git-only --confirm`
- Setup: safe point exists, clean working tree, no new commits, no untracked deletion needed.
- Action: run confirmed command.
- Expected observable result: Git rollback executes using the previewed plan and reports success.
- Why this proves Phase `3`: confirmed execution exists but is gated.

### Negative/Fallback Tests

- Entry point: `playspec rollback --git-only --confirm`
- Setup: safe point exists and working tree has uncommitted changes.
- Action: run confirmed rollback.
- Expected observable result: exit failure or blocked result; no Git mutation; recommendation says state-only rollback.
- Why this proves Phase `3`: dirty tree guard.

- Entry point: `playspec rollback --git-only --confirm`
- Setup: safe point exists and a new commit exists after safe point.
- Action: run confirmed rollback.
- Expected observable result: automatic patch rollback blocked; no mutation.
- Why this proves Phase `3`: new-commit guard.

- Entry point: `playspec rollback --git-only`
- Setup: safe point exists and rollback would require deleting an untracked file.
- Action: run preview/confirm.
- Expected observable result: untracked deletion refused.
- Why this proves Phase `3`: untracked deletion remains out of scope.

- Entry point: `playspec rollback --state-only`
- Setup: task has no `rollback.lastSafePoint`.
- Action: run state-only rollback.
- Expected observable result: clear `PlaySpecError` and hint; no files changed.
- Why this proves Phase `3`: safe failure path.

- Entry point: `YamlTaskStore.getTask()`
- Setup: old-style task YAML without `stateSync` or `rollback`.
- Action: load task.
- Expected observable result: task parses successfully.
- Why this proves Phase `3`: backward compatibility.

### Lifecycle/Reset Tests

- Entry point: `PlaySpecCore.completePhase()` under held task lock.
- Setup: reuse existing lock test and ensure Phase `3` metadata does not bypass lock.
- Action: hold lock, call complete.
- Expected observable result: `LockTimeoutError`.
- Why this proves Phase `3`: sync/safe-point metadata is part of locked completion lifecycle.

- Entry point: `playspec rollback --state-only`
- Setup: safe point exists; future artifacts are present in `prompts/`, `evidence/`, `reviews/`, `snapshots/`.
- Action: run state-only rollback twice.
- Expected observable result: first run quarantines future artifacts and restores task; second run does not corrupt state or fail due to already-moved artifacts.
- Why this proves Phase `3`: repeated rollback does not create incoherent task state.

### Bypass-Prevention Tests

- Entry point: `PlaySpecCore.renderNextPrompt()`
- Setup: high desync exists.
- Action: call raw render method directly.
- Expected observable result: prompt renders without warning.
- Why this proves Phase `3`: documents that raw render remains unchecked; safety belongs to `checkTaskDesync()` and CLI `next`.

- Entry point: `playspec phase 3`
- Setup: high desync exists.
- Action: run CLI phase.
- Expected observable result: no required high-desync warning unless optional phase warning was implemented.
- Why this proves Phase `3`: contains optional bypass scope and prevents false safety claims.

### Reviewer Demo Scenario

1. Initialize temp workspace and Git repo.
2. Create a `multi-spec` task.
3. Run `playspec complete`.
4. Modify a tracked file and run `playspec desync-check`; observe `medium`.
5. Commit a change or delete a phase output file and run `playspec desync-check`; observe `high`.
6. Run `playspec next`; observe warning before prompt.
7. Run `playspec rollback --git-only`; observe preview and confirm command only if safe.
8. Dirty the working tree and run `playspec rollback --git-only --confirm`; observe blocked mutation and state-only recommendation.
9. Run `playspec rollback --state-only`; observe `task.yaml` restored and future artifacts quarantined.

## 14. Blockers/Open Questions

No architecture/spec-level blockers remain.

Implementation caveat: confirmed Git rollback mechanics need a precise low-level strategy during implementation. The plan must use the already computed rollback plan and must not use destructive broad commands. If the implementer cannot express a safe targeted Git rollback with current Git evidence, mark Git execution as blocked in code and keep preview/state-only behavior complete.

## 15. Handoff Notes for Implementer

- Start with types/schemas/store completion metadata before CLI work; every later feature depends on persisted safe-point data.
- Keep `PlaySpecCore.checkTaskDesync(taskId)` and rollback APIs task-explicit.
- Keep raw render methods unchecked and do not hide warning behavior inside template rendering.
- Build CLI output after Core result shapes are stable.
- Tests should prove observable CLI/Core behavior, not just DTO existence.
- Run `pnpm build` and `pnpm test` after implementation.
