# feat: add safe phase recovery (rewind + phase --set/--select)

## Summary

- **New command** `playspec rewind [--steps <n>] [--task <id>] [--yes]` — moves `task.currentPhase` backward by N ordered positions in `workflow.phaseOrder`. Interactive mode defaults to 1 step and asks `Proceed? [y/N]`; non-interactive mode requires all three flags.
- **Extended command** `playspec phase [phaseId]` — adds `--set <phaseId>` (explicit target) and `--select` (arrow-key picker) options; existing positional render-only path is fully preserved.
- **Core method** `PlaySpecCore.setCurrentPhase(taskId, targetPhaseId)` — validates active status and target membership in both `workflow.phaseOrder` and `workflow.phases`, then persists only `{ currentPhase }` via `TaskStore.updateTask()`.
- **Storage safety** `YamlTaskStore.updateTask()` now validates the merged record with `TaskRecordSchema` and writes via `writeTextFileAtomic()` instead of the previous non-atomic `saveTask()` path.

Every recovery mutation changes only `currentPhase` and `updatedAt` in `task.yaml`. `phaseHistory`, `status`, `stateSync`, rollback metadata, evidence, snapshots, prompts, reviews, outputs, and sources are never touched.

## Changed Files

| File | Kind | What changed |
|---|---|---|
| `src/core/errors.ts` | modified | Added `NoExplicitPhasePointerError`, `InvalidRecoveryTargetError`, `RewindOutOfRangeError`, `InvalidRewindStepsError`, `AmbiguousPhaseCommandError` |
| `src/core/types.ts` | modified | Added `SetCurrentPhaseResult` interface |
| `src/core/playspec-core.ts` | modified | Added `setCurrentPhase()` method |
| `src/storage/yaml-task-store.ts` | modified | `updateTask()` now validates + writes atomically |
| `src/cli/commands/rewind.ts` | **new** | `playspec rewind` implementation |
| `src/cli/commands/phase.ts` | modified | Added `--set`, `--select`, `--task`, `--yes` branches; preserved render-only positional path |
| `src/cli/index.ts` | modified | Registered `rewind`; changed `phase <phaseId>` to `phase [phaseId]`; wired new phase options |
| `tests/cli.test.ts` | modified | +18 end-to-end tests: rewind and phase --set/--select happy/failure/cancellation paths |
| `tests/integration/completion-engine.test.ts` | modified | +4 integration tests: `setCurrentPhase` core mutation and preservation invariants |

## Test Plan

- `pnpm test`: **256 tests, all passed** (238 before; +18 CLI + 4 integration).
- `pnpm build`: clean, no TypeScript errors.

### Coverage added

**`playspec rewind`**
- [x] Non-interactive success: `--task --steps --yes` mutates only `currentPhase` + `updatedAt`
- [x] Non-interactive missing `--task` → fails before write
- [x] Non-interactive missing `--steps` → fails before write
- [x] Non-interactive missing `--yes` → fails before write
- [x] `currentPhase === null` → `NoExplicitPhasePointerError`
- [x] `--steps` out of range → `RewindOutOfRangeError`
- [x] Invalid `--steps` (0, negative, non-integer) → `InvalidRewindStepsError`
- [x] Inactive task → `TaskNotActiveError`
- [x] Interactive PTY confirm → mutates
- [x] Interactive PTY cancel → no write, prints `Cancelled. Phase not changed.`

**`playspec phase --set`**
- [x] Non-interactive success with `--task --set --yes`
- [x] Non-interactive missing `--task` → fails before write
- [x] Non-interactive missing `--yes` → fails before write
- [x] Invalid target phase → `InvalidRecoveryTargetError` with allowed values
- [x] Backward move → stderr warning, mutation proceeds
- [x] Skip-forward move → stderr warning, mutation proceeds
- [x] Ambiguous `phase <phaseId> --set <other>` → `AmbiguousPhaseCommandError`

**`playspec phase --select`**
- [x] Non-interactive mode → fails with error
- [x] Interactive PTY cancel (Esc) → no write

**`playspec phase <phaseId>` (preserved)**
- [x] Positional phaseId with no mutating flags → still render-only
- [x] `playspec phase set` / `playspec phase select` → render-only (not mutating aliases)

**Core integration**
- [x] `setCurrentPhase` changes `currentPhase` and `updatedAt`, preserves `phaseHistory`
- [x] Rejects inactive task
- [x] Rejects target not in `workflow.phaseOrder`
- [x] Artifact directories unchanged after recovery

## Behavior Not Changed

- `playspec complete` behavior is unchanged; `PlaySpecCore.completePhase()` is unmodified.
- MCP tools (`playspec_complete_phase`, `playspec_render_phase_prompt`) are unmodified.
- `playspec rollback` is unmodified.
- Migration paths are unmodified.
- Workflow and preset templates are unmodified.

## Known Limitations / Remaining Risks

| Risk | Notes |
|---|---|
| Selector terminal restoration under signals | `selectPhase` restores terminal on cancel/error but SIGKILL cannot restore raw mode. Same limitation as the existing `use` selector. |
| `workflow.phaseOrder` / `workflow.phases` disagreement | Core validates both; if a workflow defines a phase in `phaseOrder` but not in `phases`, recovery correctly rejects the target. No workflow schema fix added (out of scope). |
| PTY confirmation timing after `--select` | Brief window between raw-mode selector exit and readline init; not tested under high load. |
