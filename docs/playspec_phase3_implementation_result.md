# PlaySpec Phase 3 Implementation Result

## Phase summary

Dev Phase `3` (`Reality Safety`) is implemented on the active CLI/Core/store path.

Implemented scope:

- `StateDesyncDetector`
- persisted `stateSync.lastKnownGitHead` and `stateSync.lastCompletedAt`
- rollback safe-point metadata
- changed/deleted/renamed/untracked file reporting
- severity calculation
- `playspec next` high-desync warning before prompt rendering
- `playspec desync-check`
- `playspec rollback`
- `playspec rollback --state-only`
- `playspec rollback --git-only`
- `playspec rollback --git-only --confirm`
- state-only rollback from validated full task snapshot
- rollback quarantine for future PlaySpec artifacts
- Git rollback preview and safety gates

Intentionally deferred:

- MCP adapter/tools
- archive/close behavior
- viewer/timeline
- evolution/harness/SQLite/DAG work
- auto-stash
- untracked file deletion
- broad write-lock retrofit for older non-Phase-3 paths

## Intended scope vs actual scope

Actual scope matches Phase `3` Reality Safety. The implementation adds no MCP, archive, viewer, evolution, harness, SQLite, or DAG behavior.

Confirmed Git rollback uses the previewed target file list only. If the safe plan has no target files, confirmation is a successful no-op; it never runs a broad repo restore.

## Changed files

- `src/cli/index.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/desync-check.ts`
- `src/cli/commands/rollback.ts`
- `src/core/errors.ts`
- `src/core/git-state.ts`
- `src/core/playspec-core.ts`
- `src/core/rollback-manager.ts`
- `src/core/schemas.ts`
- `src/core/state-desync-detector.ts`
- `src/core/types.ts`
- `src/storage/yaml-task-store.ts`
- `tests/cli.test.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/task-store.test.ts`

## Changed classes / functions

- `PlaySpecCore`
  - `checkTaskDesync()`
  - `planRollback()`
  - `rollbackStateOnly()`
  - `executeGitRollback()`
  - `completePhase()`
  - `buildRollbackSafePoint()`
- `GitState`
  - `getCurrentHead()`
  - `getWorkspaceState()`
  - `getDiffStat()`
  - `listCommitsAfter()`
  - `listNameStatusSince()`
- `StateDesyncDetector`
  - `run()`
- `RollbackManager`
  - `plan()`
  - `rollbackStateOnly()`
  - `executeGitRollback()`
  - `quarantineFutureArtifacts()`
- `YamlTaskStore`
  - `createTask()`
  - `completePhase()`
- CLI:
  - `runNext()`
  - `runDesyncCheck()`
  - `runRollback()`

## Implementation-plan step coverage

| Step | Result |
|---|---|
| P1 task metadata contracts | complete |
| P2 zod schemas | complete |
| P3 atomic completion metadata contract | complete |
| P4 normalized new tasks and atomic metadata write | complete |
| P5 Core Git helper | complete |
| P6 StateDesyncDetector | complete |
| P7 Core desync API | complete |
| P8 completion safe-point capture | complete |
| P9 `next` warning | complete |
| P10 `desync-check` CLI | complete |
| P11 command registration | complete |
| P12 rollback manager | complete |
| P13 Core rollback APIs | complete |
| P14 rollback CLI | complete |
| P15 artifact quarantine | complete |
| P16 recovery errors | complete |
| P17 exports | not needed; public behavior is exercised through `PlaySpecCore` and CLI |
| P18 tests | complete; focused follow-up added coverage for rename detection, untracked reporting, rollback preview, new-commit guard, and untracked rollback-target conflict guard |

## Spec coverage before vs after

Before implementation:

- `stateSync` / `rollback` task fields: missing
- desync detector: not in codebase
- `next` sanity check: missing
- `desync-check`: not in codebase
- rollback manager/API/CLI: not in codebase
- completion safe-point metadata: partial through passive snapshots only

After implementation:

- task sync and rollback metadata are persisted and schema-validated
- completion writes phase state, sync metadata, and safe point in one atomic store mutation
- `StateDesyncDetector` reports severity and file categories
- `next` warns before prompt rendering on high desync
- `desync-check` reports severity, Git heads, file lists, reasons, and recommendation
- rollback preview/state-only/confirmed Git modes are wired through explicit task Core APIs
- dirty tree, new commits, branch divergence, and untracked rollback-target conflicts block Git rollback mutation

Focused test follow-up:

- `tests/integration/completion-engine.test.ts` covers renamed tracked file desync through `PlaySpecCore.checkTaskDesync(taskId)`
- `tests/cli.test.ts` covers untracked `desync-check` output, default rollback preview, `--git-only` preview, state-only rollback sync metadata restoration, new-commit confirmed rollback blocking, and untracked rollback-target conflict blocking
- state-only rollback now restores `stateSync` from the safe point when the restored task snapshot has null sync fields

## Build / compile validation summary

- `npx tsc --noEmit`: success
- `corepack pnpm build`: success
- `npx vitest run tests/cli.test.ts tests/integration/completion-engine.test.ts tests/integration/task-store.test.ts`: success, `3` files passed, `33` tests passed
- `npx vitest run`: success, `11` files passed, `73` tests passed

Blocking: no.

Log path: none generated.

## End-to-end validation result

- active entry point exists: yes
- active `next` path uses `PlaySpecCore.checkTaskDesync(taskId)` before rendering: yes
- old raw render path remains unchecked and documented by scope: yes
- completion persists safe point and `stateSync` atomically: yes
- state-only rollback restores a validated task snapshot: yes
- state-only rollback preserves safe-point sync metadata: yes
- state-only rollback does not mutate project Git files: yes
- future PlaySpec artifacts are quarantined under `rollback/<safePointId>/`: yes
- Git rollback preview prints safety details and confirm command when eligible: yes
- confirmed Git rollback executes only after all safety gates pass and only against previewed target files: yes
- build/test validation succeeds: yes

Overall status: Phase `3` is safely complete in the current CLI/Core/store path.

## Remaining old / bypass / partial path issues

- Raw `PlaySpecCore.renderNextPrompt()` and `renderExplicitPhasePrompt()` remain unchecked primitives by design.
- `playspec phase` does not warn on desync; Phase `3` only requires `next`.
- Existing older unlocked paths remain outside Phase `3`:
  - `src/cli/commands/create.ts`
  - `src/cli/commands/use.ts`
  - `src/preset/preset-manager.ts`
  - prompt export in `src/cli/commands/next.ts --write`

These do not invalidate the Phase `3` active path.

## Unresolved blockers or ambiguities

- none

## Intentionally deferred items

- MCP adapter/tools
- archive/close flows
- markdown viewer
- evolution system
- harness retry/circuit breaker
- auto-stash
- untracked deletion
- SQLite
- DAG execution

## Next-phase readiness recommendation

Ready for Dev Phase `4`.

Reason:

- Core now exposes explicit-task desync and rollback APIs.
- CLI-only HEAD fallback remains outside Core.
- `next` has a pre-render safety check.
- rollback behavior is guarded and observable.
- full build/test validation succeeds.

## Deviations from spec

- none
