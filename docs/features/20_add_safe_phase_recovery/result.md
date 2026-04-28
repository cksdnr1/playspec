# 20-add-safe-phase-recovery Implementation Result

## Files Changed

| File | Change |
|------|--------|
| `src/core/errors.ts` | Added `NoExplicitPhasePointerError`, `InvalidRecoveryTargetError`, `RewindOutOfRangeError`, `InvalidRewindStepsError`, `AmbiguousPhaseCommandError` |
| `src/core/types.ts` | Added `SetCurrentPhaseResult` interface |
| `src/core/playspec-core.ts` | Added `setCurrentPhase()` method; imported `InvalidRecoveryTargetError` and `SetCurrentPhaseResult` |
| `src/storage/yaml-task-store.ts` | Changed `updateTask()` to validate with `TaskRecordSchema` and persist via `writeTextFileAtomic()` instead of non-atomic `saveTask()` |
| `src/cli/commands/rewind.ts` | New file — implements `playspec rewind [--steps <n>] [--task <id>] [--yes]` |
| `src/cli/commands/phase.ts` | Extended with `--set`, `--select`, `--task`, `--yes` options while preserving render-only positional path |
| `src/cli/index.ts` | Registered `rewind` command; changed `phase <phaseId>` to `phase [phaseId]`; added options to `phase` |
| `tests/integration/completion-engine.test.ts` | Added `setCurrentPhase` integration tests (4 tests) |
| `tests/cli.test.ts` | Added CLI tests for `rewind` and `phase --set/--select` (18 tests) |

## Behavior Implemented

### `playspec rewind`
- Interactive (default): resolves HEAD task, defaults to 1 step, shows confirmation text with task/current/target phase, asks `Proceed? [y/N]`; requires explicit 'y' to mutate.
- Non-interactive: requires `--task`, `--steps`, and `--yes`; proceeds without prompt.
- Validates: `task.status === 'active'`, `currentPhase !== null`, current phase in `workflow.phaseOrder`, `steps > 0` integer, `currentIndex - steps >= 0`.
- Prints `Rewound: <from> -> <to>` on success.
- Prints `Cancelled. Phase not changed.` on cancel.

### `playspec phase --set <phaseId>`
- Non-interactive: requires `--task` and `--yes`.
- Interactive: shows same confirmation text; requires explicit 'y'.
- Warns to stderr when target is backward or skips forward by more than one phase.
- Validates target via `PlaySpecCore.setCurrentPhase()` (both `phaseOrder` and `workflow.phases` membership required).
- Prints `Phase set: <from> -> <to>` on success.

### `playspec phase --select`
- Only works in interactive mode; fails with error in non-interactive mode.
- Displays arrow-key selector of all `workflow.phaseOrder` phases with preselection at current phase.
- ESC/Ctrl+C cancels; Enter selects; then goes through same confirmation + mutation path as `--set`.
- Terminal state is restored on success, cancel, and error.

### `playspec phase <phaseId>` (preserved)
- Positional phaseId with no mutating options continues to be render-only.
- Positional phaseId + `--set` or `--select` → `AmbiguousPhaseCommandError`.
- `playspec phase set` and `playspec phase select` continue to be treated as render-only positional phase IDs (not mutating aliases).

### `PlaySpecCore.setCurrentPhase()`
- Validates `task.status === 'active'`.
- Validates target in both `workflow.phaseOrder` and `workflow.phases`.
- Persists only `{ currentPhase: targetPhaseId }` via `taskStore.updateTask()`.
- Returns `{ taskId, previousPhase, currentPhase }`.

### `YamlTaskStore.updateTask()` — atomic write
- Now validates merged task with `TaskRecordSchema` and writes with `writeTextFileAtomic()`, matching the safety level of `completePhase()`.

## Verification Performed

- `pnpm test`: **256 tests, all passed** (was 238 before; 18 new CLI tests + 4 new integration tests added).
- `pnpm build`: clean, no TypeScript errors.
- New tests cover:
  - Non-interactive rewind: success, missing `--task`, missing `--steps`, missing `--yes`.
  - Rewind edge cases: `currentPhase === null`, out-of-range, invalid `--steps`, inactive task.
  - Interactive rewind: PTY confirm → mutates, PTY cancel → no write.
  - `phase --set` non-interactive: success, missing `--task`, missing `--yes`, invalid target.
  - `phase --set` warnings: backward, skip-forward.
  - `phase --select` non-interactive: fails.
  - `phase --select` PTY cancel: no write.
  - `phase <phaseId>` render-only preserved; `phase set` treated as positional (not alias).
  - Ambiguous `phase <phaseId> --set` rejected.
  - `setCurrentPhase` core: changes phase + updatedAt, preserves phaseHistory, rejects inactive tasks, rejects invalid targets, preserves artifact directories.
  - `phaseHistory` is preserved verbatim after recovery.

## Implementation Invariants Confirmed

- Recovery writes only `task.yaml`.
- Only `currentPhase` and `updatedAt` change inside `task.yaml`.
- `phaseHistory`, `status`, `stateSync`, `rollback`, evidence, snapshots, prompts, reviews, outputs, and sources are unchanged.
- Recovery accepts only active tasks.
- Recovery accepts only targets present in both `workflow.phaseOrder` and `workflow.phases`.
- Cancellation and validation failure are non-mutating.
- `playspec complete`, rollback, MCP, and migration behavior unchanged.

## Remaining Risks

| Risk | Notes |
|------|-------|
| Selector terminal restoration under unexpected errors | The `selectPhase` function has a try/catch that calls `cancel()` on error, which calls `restore()`. However, uncaught signals (SIGKILL) cannot restore terminal state. This is the same limitation as the existing `use` selector. |
| `workflow.phases` and `workflow.phaseOrder` disagreement | The Core validates both; if a workflow YAML defines a phase in `phaseOrder` but not in `phases`, recovery correctly rejects the target. No workflow schema enforcement fix was added (out of scope). |
| PTY confirmation timing in `--select` | After the raw-mode selector finishes, there is a brief window before readline initializes. Input arriving during this window may be buffered correctly on most systems, but has not been tested under extreme load. |

## Final Notes

- PR file: `docs/features/20_add_safe_phase_recovery/pr.md`
- Reusable agent guidance: **no new agent guidance document is warranted**. The implementation follows established patterns from `src/cli/commands/use.ts` (selector) and `src/cli/commands/complete.ts` (confirmation), which are already present in the codebase and readable inline.
- Commands run in final validation: `pnpm test` (256/256 pass), `pnpm build` (clean).
- Branch: `20-add-safe-phase-recovery`
