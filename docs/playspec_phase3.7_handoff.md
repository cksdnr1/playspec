# Phase 3.7 Handoff: Simple Conditional Routing with Human Selection

## Phase summary

Phase 3.7 adds simple result-based routing inside one PlaySpec task. A workflow phase can declare allowed result values, map those results to next phases, and cap repeated visits with `maxVisits`.

The result remains human-authoritative: either selected interactively or passed as `--result`. No AI output parsing, DAG execution, or automatic spawning belongs in this phase.

## Current goal

Make `playspec complete` capture a valid result for result-bearing phases, persist it to task history with a visit count, and move the task to the correct mapped next phase so `playspec next` renders the routed prompt.

## Locked file set

### Must-read

- `docs/playspec_phase_plan.md`
- `docs/playspec_total_spec.md`
- `src/cli/index.ts`
- `src/cli/commands/complete.ts`
- `src/cli/commands/next.ts`
- `src/core/playspec-core.ts`
- `src/workflow/phase-resolver.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/active-task-resolver.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/cli.test.ts`
- `tests/unit/phase-resolver.test.ts`

### Maybe-read

- `src/workflow/workflow-loader.ts`
- `src/workflow/workflow-schema.ts`
- `src/core/errors.ts`
- `src/preset/assets/default/workflows/multi-spec.yaml`
- `tests/integration/workflow-loader.test.ts`
- `src/cli/commands/phase.ts`
- `src/cli/context-header.ts`

### Ignore-for-now

- MCP/server files and Phase 4+ docs.
- Viewer, archive, evolution, migration, and project hierarchy work.
- Template rendering internals unless routing tests expose prompt regressions.
- Desync, rollback, evidence, and snapshot internals except shared completion state.

## Verified facts

- `playspec complete` currently has no `--result` option in `src/cli/index.ts`.
- `runComplete` calls `PlaySpecCore.completePhase(task.id, { withReview })` and does not inspect workflow results.
- `PlaySpecCore.completePhase` resolves the current phase, writes completion artifacts, computes linear next phase, and persists state.
- `PhaseResolver.resolveNextPhase` advances through `phaseOrder`.
- `WorkflowDefinitionSchema` and `PhaseDefinitionSchema` do not include `results`, `nextByResult`, or `maxVisits`.
- `PhaseHistoryEntrySchema` does not include `result` or `visitCount`.
- `YamlTaskStore.buildPhaseHistory` removes prior completed entries for the same phase before appending the new one.
- `playspec next` renders the task's current phase; it does not route on its own.

## Key control flow

Current:

```text
playspec complete
  -> ActiveTaskResolver.resolveTask
  -> PlaySpecCore.completePhase
  -> PhaseResolver.resolveCurrentPhase
  -> PhaseResolver.resolveNextPhase
  -> YamlTaskStore.completePhase
  -> task.currentPhase = linear next phase
```

Phase 3.7 target:

```text
playspec complete [--result value]
  -> ActiveTaskResolver.resolveTask
  -> load workflow/current phase for prompt decision if needed
  -> collect explicit or interactive result when phase has results
  -> PlaySpecCore.completePhase({ result })
  -> validate result, mapping target, visit count, maxVisits before artifact writes
  -> YamlTaskStore.completePhase persists result and visitCount
  -> task.currentPhase = routed next phase
  -> playspec next renders task.currentPhase
```

## Known constraints

- Preserve the single-task model.
- Do not introduce `project.yaml`.
- Do not introduce MCP.
- Do not introduce DAG or parallel execution.
- Do not auto-apply or auto-select routing from AI output.
- Core must receive explicit task IDs; HEAD fallback stays in CLI.
- Linear workflows without routing fields must continue to work.

## Active entry points

- `src/cli/index.ts` `complete` command: add `--result <value>`.
- `src/cli/commands/complete.ts` `runComplete`: collect or forward result.
- `src/core/playspec-core.ts` `PlaySpecCore.completePhase`: authoritative result validation and route resolution.
- `src/workflow/phase-resolver.ts`: likely home for focused route resolution or helper method.
- `src/storage/task-store.ts` and `src/storage/yaml-task-store.ts`: persistence for result and visit count.
- `src/cli/commands/next.ts` `runNext`: should keep rendering `task.currentPhase`; avoid duplicating routing here.

## Possible bypasses

- Direct Core call without result: must fail for result-bearing phases.
- CLI-only validation: insufficient because tests and future adapters call Core directly.
- Direct TaskStore calls can persist arbitrary state; treat TaskStore as persistence, not routing authority.
- Linear `resolveNextPhaseId` can remain an old-path bypass if routed phases still call it.
- `phaseHistory.result` is the single persisted source of truth for routing decisions. Do not add authoritative `routing.currentResult` in Phase 3.7.

## Phase outcome at a glance

### After this phase, you can

- Define `results`, `nextByResult`, and `maxVisits` in workflow YAML.
- Complete a routed phase with `--result`.
- Prompt for a result in interactive completion.
- Persist `phaseHistory[].result` and `phaseHistory[].visitCount`.
- Render the routed next phase with `playspec next`.
- Block loops that exceed `maxVisits`.

### After this phase, you still cannot

- Execute a DAG.
- Run phases in parallel.
- Spawn tasks automatically.
- Let AI output choose the result.
- Use MCP for routing.

## Enabled use cases

- Approval branch: validation result `approved` routes to implementation.
- Patch branch: validation result `needs_patch` routes to spec patch.
- Revalidation loop: a patch path can return to validation and increment visit count.
- Non-interactive automation: `playspec complete --result approved` can be used safely.

## Still-blocked or deferred use cases

- Automatic result inference from model output.
- Multi-task orchestration.
- Project-level workflow state.
- Arbitrary graph execution.
- Phase 4 MCP tool parity.

## Concrete testable outcomes

- Workflow loader accepts routed phase fields.
- Core completion rejects missing result for result-bearing phases.
- CLI completion rejects missing `--result` in non-interactive execution.
- CLI completion accepts valid `--result`.
- Invalid result fails with allowed values and leaves task YAML unchanged.
- Missing `nextByResult` mapping fails before mutation.
- Invalid mapped phase fails before mutation.
- Completion stores `result` and `visitCount`.
- Repeated visits append completed history entries and increment visit count from completed entries only.
- `maxVisits` fails before completion artifacts/state mutation.
- Result validation, route resolution, mapped-target validation, visit count calculation, and `maxVisits` enforcement happen before snapshots, evidence, review files, rollback state, or task YAML writes.
- Linear workflows still pass existing completion tests.
- `playspec next` after routed completion renders the mapped phase prompt.

## Reviewer demo checklist

- Create a temporary workflow with `validation`, `implementation`, and `spec_patch`.
- Add `results: [approved, needs_patch]` to `validation`.
- Add `nextByResult.approved: implementation`.
- Run `playspec complete --result approved`.
- Confirm stdout shows the mapped next phase.
- Inspect `task.yaml` for `result: approved` and `visitCount: 1`.
- Run `playspec next`.
- Confirm the rendered prompt is the implementation phase.
- Run an invalid result and confirm task YAML does not change.
- Exercise a route loop until `maxVisits` is exceeded and confirm the guard error.

## Open questions

No architecture/spec-level open questions remain.

Locked decisions:

- Every `nextByResult` target must be an existing workflow phase. Terminal routed mappings are out of Phase 3.7; task completion remains the existing linear final-phase behavior.
- `phaseHistory.result` is authoritative. Do not persist authoritative `routing.currentResult` in Phase 3.7.
- Unexpected `--result` on a non-routed phase should be rejected to avoid misleading state and stale automation arguments.
- Optional recommendation hints may be implemented only from explicit CLI/Core input, must remain non-authoritative, and must not influence routing unless the human or `--result` selects that value.

## Next phase dependency

Phase 4 MCP work can safely begin only after routed completion behavior is available through Core with explicit task IDs. MCP must not need to inspect CLI prompts or HEAD to determine route state.

---

## Implementation status (updated 2026-04-26)

**Status: Complete**

### Migration status

All active entry points migrated:
- `src/cli/index.ts`: `--result <value>` registered on `complete`
- `src/cli/commands/complete.ts`: interactive selection and non-interactive guard wired
- `src/core/playspec-core.ts`: authoritative routing validation in `resolveRoutedCompletion` (runs before artifact writes)
- `src/storage/yaml-task-store.ts`: history deduplication removed; `result` and `visitCount` persisted

### Verifier result summary

All 13 spec use cases verified:
- Linear completion unaffected ✓
- Workflow schema accepts routing fields ✓
- Explicit routed completion ✓
- Invalid result guard ✓
- Missing result guard ✓
- Missing mapping guard ✓
- Invalid mapping target guard ✓
- Visit count increments correctly ✓
- `maxVisits` loop guard fires before mutation ✓
- `playspec next` renders routed phase ✓
- CLI `--result` accepted ✓
- CLI non-interactive error ✓
- CLI invalid result error ✓

### Build validation summary

- `npm run build`: success (zero TypeScript errors)
- `npm test`: 101/101 pass (86 pre-existing + 15 new Phase 3.7 tests)

### Unresolved blockers

None.

### Next-phase readiness

Phase 4 MCP adapter can safely begin.
