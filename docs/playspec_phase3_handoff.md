# PlaySpec Phase 3 Handoff

## Implementation Status

Phase `3` implementation is complete on the active CLI/Core/store path.

Implemented:

- `StateDesyncDetector`
- persisted `stateSync.lastKnownGitHead`
- persisted `stateSync.lastCompletedAt`
- rollback safe-point metadata
- `playspec next` high-desync warning before prompt output
- `playspec desync-check`
- `playspec rollback`
- `playspec rollback --state-only`
- `playspec rollback --git-only`
- `playspec rollback --git-only --confirm`
- state-only rollback from a validated full task snapshot
- quarantine of future PlaySpec artifacts under `rollback/<safePointId>/`
- Git rollback preview and confirmed execution behind safety gates

## Migration Status

- active `next` path is now `CLI -> ActiveTaskResolver -> PlaySpecCore.checkTaskDesync(taskId) -> PlaySpecCore.renderNextPrompt(taskId)`
- active completion path now persists completion state, `stateSync`, and rollback safe point in the same `TaskStore.completePhase()` mutation
- rollback/desync Core APIs accept explicit `taskId`; Core does not resolve global `HEAD`
- raw render methods remain unchecked primitives by design
- `playspec phase` desync warning remains deferred because Phase `3` only requires `next`

## Verifier Result Summary

- pre-implementation: Phase `3` desync detector, rollback APIs, CLI commands, task metadata, and `next` warning were missing or partial
- post-implementation: required Phase `3` behavior is covered on the active CLI/Core/store path
- post-test follow-up: focused coverage is complete for rename detection, untracked desync output, rollback preview, state-only rollback sync metadata restoration, new-commit Git rollback guard, and untracked rollback-target conflict guard
- refactor guard: allowed after removing unused optional sync metadata
- test refactor guard: allowed
- remaining non-codebase items are deferred later-phase features:
  - MCP
  - archive/close
  - viewer
  - evolution
  - harness
  - SQLite
  - DAG

## Build Validation Summary

- `npx tsc --noEmit`: success
- `corepack pnpm build`: success
- `npx vitest run tests/cli.test.ts tests/integration/completion-engine.test.ts tests/integration/task-store.test.ts`: success (`3` files passed, `33` tests passed)
- `npx vitest run`: success (`11` files passed, `73` tests passed)

## Unresolved Blockers

- none

## Next-Phase Readiness

Ready for Dev Phase `4`.

Why:

- explicit-task Core APIs exist for desync and rollback
- `next` warns before prompt rendering when desync is high
- rollback preview/state-only/confirmed Git modes are guarded and observable
- build and test validation succeeded

## Active Entry Points and Remaining Old / Bypass Paths

### active entry points

- `src/cli/index.ts`
  - `desync-check`
  - `rollback`
  - `next`
- `src/cli/commands/next.ts`
  - high-desync warning before prompt rendering
- `src/core/playspec-core.ts`
  - `checkTaskDesync(taskId)`
  - `planRollback(taskId)`
  - `rollbackStateOnly(taskId)`
  - `executeGitRollback(taskId)`

### remaining old / bypass paths

- `PlaySpecCore.renderNextPrompt()` and `renderExplicitPhasePrompt()` remain unchecked primitives
- `playspec phase` does not run a desync warning
- older unlocked non-Phase-3 write paths remain:
  - `src/cli/commands/create.ts`
  - `src/cli/commands/use.ts`
  - `src/preset/preset-manager.ts`
  - `src/cli/commands/next.ts --write`

These are known scoped bypasses and do not invalidate Phase `3`.

## Test Status

- focused Phase `3` test result recorded in `docs/playspec_phase3_test_result.md`
- active paths covered: completion sync/safe point persistence, desync detection, `next` warning, `desync-check`, rollback preview, state-only rollback with safe-point sync metadata restoration, and guarded confirmed Git rollback
- active paths not covered by this follow-up: none identified
- remaining old/bypass paths affecting confidence: raw render primitives and `playspec phase` remain unchecked by design

## Phase summary

Dev Phase `3` is Reality Safety. It adds state/Git desync detection and safe rollback behavior on top of the Phase `2` completion baseline.

The implementation should stay narrow: warn before unsafe `next`, expose `desync-check`, support state-only rollback, provide Git rollback preview, and allow confirmed Git rollback only when every safety gate passes.

## Current goal

Make PlaySpec stop blindly trusting `task.yaml` when the real Git workspace has changed after the last completion/safe point.

## Locked file set

### must-read

- `docs/playspec_phase_plan.md`
- `docs/playspec_total_spec.md`
- `docs/playspec_phase2_handoff.md`
- `docs/playspec_phase2_implementation_result.md`
- `src/cli/index.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/complete.ts`
- `src/core/playspec-core.ts`
- `src/core/active-task-resolver.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/utils/fs.ts`
- `src/utils/paths.ts`
- `src/core/errors.ts`

### maybe-read

- `src/cli/commands/evidence.ts`
- `src/cli/commands/snapshot.ts`
- `src/cli/commands/phase.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/cli.test.ts`
- `tests/integration/active-task-resolver.test.ts`
- `tests/helpers/createTempWorkspace.ts`
- `package.json`

### ignore-for-now

- `src/template/**`
- `src/workflow/**` except phase resolution needed by rollback tests
- `src/preset/**` except test setup
- `src/core/session-resolver.ts`
- MCP, archive, viewer, evolution, harness, DAG paths

## Verified facts

- Phase `2` active completion path is implemented.
- `PlaySpecCore.completePhase()` writes completion snapshots/evidence/review, then calls `TaskStore.completePhase()`.
- `YamlTaskStore.completePhase()` atomically updates `task.yaml`.
- `PlaySpecCore.writeEvidence()` already shells out to Git and writes status, diff stat, and changed-file evidence.
- `TaskRecord` has no `stateSync` or `rollback` field.
- `TaskRecordSchema` has no `stateSync` or `rollback` schema.
- There is no `StateDesyncDetector`.
- There is no rollback manager.
- `playspec desync-check` and `playspec rollback` are not registered in `src/cli/index.ts`.
- `runNext()` renders without desync sanity check.

## Key control flow

Current active completion flow:

```text
playspec complete
-> runComplete()
-> ActiveTaskResolver.resolveTask()
-> PlaySpecCore.completePhase(task.id)
-> writeSnapshots()
-> writeEvidence()
-> writeReview() when requested
-> TaskStore.completePhase()
-> YamlTaskStore.completePhase()
-> atomic task.yaml write
```

Current active next flow:

```text
playspec next
-> runNext()
-> ActiveTaskResolver.resolveTask()
-> PlaySpecCore.renderNextPrompt(task.id)
-> PhaseResolver + VariableResolver + TemplateRenderer
-> prompt printed
```

Required Phase `3` next flow:

```text
playspec next
-> resolve task
-> Core desync check for taskId
-> warn on high severity
-> render prompt
```

Raw Core render methods remain unchecked rendering primitives. `PlaySpecCore.checkTaskDesync(taskId)` is the checked Core boundary that `next` must call before rendering.

Required Phase `3` state-only rollback flow:

```text
playspec rollback --state-only
-> resolve task
-> load last rollback safe point
-> lock task root
-> restore full task snapshot
-> quarantine future PlaySpec artifacts under rollback/
-> validate with TaskRecordSchema
-> atomic task.yaml write
-> do not mutate project Git files outside .playspec
```

Required Phase `3` Git rollback flow:

```text
playspec rollback --git-only
-> resolve task
-> compute rollback plan/preview
-> print affected files/commits and safety reasons
-> print exact --confirm command when execution is eligible

playspec rollback --git-only --confirm
-> recompute the rollback plan at execution time
-> execute only when clean tree, no new commits, no divergence, and no untracked deletion gates pass
```

## Known constraints

- Core must receive explicit `taskId`; only CLI may use `HEAD` fallback.
- Do not add MCP before Phase `4`.
- Do not add archive behavior before Phase `5`.
- Do not delete files outside `.playspec`.
- Do not delete untracked files by default.
- Do not auto-stash.
- Do not automatically apply Git rollback when the working tree is dirty.
- Do not automatically apply patch rollback when new commits exist.
- Do not mutate Git unless `--git-only --confirm` is passed and every safety gate passes.
- Keep schema changes backward compatible for existing `task.yaml` files.

## Active entry points

- `src/cli/index.ts`
  - add `desync-check`
  - add `rollback`
  - keep `next` as the main warning path
- `src/cli/commands/next.ts`
  - add pre-render desync check
- `src/cli/commands/complete.ts`
  - completion should create/update sync and safe-point metadata through the same locked atomic completion mutation
- `src/core/playspec-core.ts`
  - add explicit-task Core methods for desync and rollback, including `checkTaskDesync(taskId)` and `planRollback(taskId)`
- `src/storage/task-store.ts`
  - extend completion/rollback persistence as needed so completion state, `stateSync`, and safe-point metadata are not split across writes
- `src/storage/yaml-task-store.ts`
  - validate and atomically persist new task state fields

## Possible bypasses

- Direct `PlaySpecCore.renderNextPrompt()` calls remain unchecked; `PlaySpecCore.checkTaskDesync(taskId)` is the explicit checked API for callers that need safety.
- `playspec phase` renders prompts and may bypass desync warning if only `next` is wired; Phase `3` requires `next`, while `phase` warning is optional.
- `playspec complete` can advance task state without sanity warning; Phase `3` requires atomic sync/safe-point metadata on completion, while high-desync warning is optional and non-blocking.
- `next --write` writes prompt files outside the task write lock.
- Existing git evidence files are passive artifacts and do not prove desync detection.
- Existing snapshots are passive artifacts and do not prove rollback behavior.

## Phase outcome at a glance

### Enabled after Phase 3

- `playspec desync-check` reports severity and changed files.
- `playspec next` warns before rendering when desync is high.
- `playspec rollback --state-only` restores task state from a safe point.
- `playspec rollback --state-only` quarantines future PlaySpec artifacts under `.playspec/tasks/.../rollback/`.
- `playspec rollback --git-only` provides preview and prints the confirm command when eligible.
- `playspec rollback --git-only --confirm` executes only when every safety gate passes.
- Dirty working tree recommends state-only rollback.

### Still blocked or deferred

- MCP desync/rollback tools.
- Archive and close flows.
- Viewer timeline for rollback points.
- Evolution and learning system.
- Harness retry safety.
- Auto-stash and untracked deletion.

## Enabled use cases

- A user completes a phase, edits code manually, then runs `desync-check` and sees drift.
- A user runs `next` after significant drift and sees a warning before prompt output.
- A user rolls back PlaySpec task state without touching source files.
- A user previews Git rollback, sees the exact confirm command when safe, and gets blocked when the tree is dirty.

## Still-blocked or deferred use cases

- MCP clients invoking rollback through PlaySpec.
- Reviewing rollback history in a web UI.
- Archiving rollback artifacts.
- Automatic resolution of drift by refreshing context.
- Automatic stash creation or untracked cleanup.

## Concrete testable outcomes

- `desync-check` on a clean post-completion task reports no meaningful drift.
- Editing a tracked file after completion reports changed file(s) and at least medium severity.
- Deleting or renaming a tracked file after completion reports high severity.
- Creating a commit after completion reports high severity because Git HEAD changed.
- Editing tracked files without moving Git HEAD reports at most medium severity unless a high rule also matches.
- `next` prints a high-desync warning before prompt output.
- `rollback --state-only` restores task state from a validated full task snapshot and leaves Git files untouched.
- `rollback --state-only` moves future PlaySpec prompt/evidence/review artifacts out of active paths into rollback quarantine.
- `rollback --git-only --confirm` executes only when the recomputed plan is safe and only targets files from that plan.
- `rollback --git-only --confirm` refuses mutation with dirty working tree.
- `rollback --git-only --confirm` refuses mutation when new commits exist.
- untracked files are not deleted by rollback.
- Heavy `projectDocRoot` threshold is deterministic: at least `10` changed files under `task.paths.projectDocRoot` or deletion/rename of any phase output document.
- Uncommitted tracked source changes after the last safe point are medium by default, not high, unless Git HEAD changed, a target file was deleted/renamed, or heavy `projectDocRoot` rules match.

## Reviewer demo checklist

- Initialize a temp workspace and Git repo.
- Create a `multi-spec` task.
- Run `playspec complete`.
- Modify or delete a tracked file.
- Run `playspec desync-check`.
- Confirm severity and file list are visible.
- Run `playspec next`.
- Confirm warning appears before the prompt.
- Run `playspec rollback --state-only`.
- Confirm `task.yaml` returned to the safe-point state.
- Confirm Git working tree content was not changed by state-only rollback.
- Create a dirty working tree and run `playspec rollback --git-only`.
- Confirm Git mutation is blocked and state-only rollback is recommended.

## Open questions

No architecture/spec-level open questions remain.

## Next phase dependency

Phase `4` MCP Adapter should only start after Phase `3` has explicit Core APIs for desync and rollback that accept `taskId` and do not read global `HEAD`.

MCP must be able to call the same Core behavior as CLI without inheriting CLI-only global state fallback.
