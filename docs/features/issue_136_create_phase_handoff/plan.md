# Issue 136 Create Phase Handoff Plan

## Ordered Implementation Steps

1. Extend `CreateTaskInput` in `src/core/types.ts` with optional `currentPhase?: PhaseId | null`.
2. Update `YamlTaskStore.createTask()` in `src/storage/yaml-task-store.ts` to persist `input.currentPhase ?? null`, preserving existing default behavior for every caller that omits it.
3. Update `src/cli/commands/create.ts` phase handoff flow:
   - Keep the resolved execution workflow from validation instead of discarding it.
   - Validate the requested `phaseNumber` with `PhaseResolver.resolveExplicitPhase()` when the selected workflow declares that phase, and always enforce it for `phase-execution`.
   - Derive handoff variables from the planning task with `FEATURE_SLUG: planningTask.variables.FEATURE_SLUG ?? planningTask.id` only when the selected workflow declares `FEATURE_SLUG`.
   - Merge variables as `{ ...planningDerivedVariables, ...parseTaskVariables(options.var) }` so explicit `--var FEATURE_SLUG=...` remains authoritative.
   - Pass `currentPhase: phaseNumber` into `store.createTask()`.
4. Extend `tests/integration/init-create-next.test.ts`:
   - Reuse the existing total-plan-to-phase-execution context test.
   - Render `prompt --no-copy` after creation.
   - Assert the rendered phase is phase 2.
   - Assert `FEATURE_SLUG`, `PHASE_SPEC_FILE`, and `PHASE_HANDOFF_FILE` use the planning slug.
   - Keep context ref assertions for total spec and phase plan.
   - Assert stored `currentPhase` and `target.phaseNumber`.
5. Update `tests/cli.test.ts` phase handoff variable-storage expectation so the stored default `FEATURE_SLUG` is planning-derived while explicit `--var` values remain stored.

## Files To Edit

- `src/core/types.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/commands/create.ts`
- `src/preset/assets/workflows/phase-execution/templates/phase_template.md`
- `tests/integration/init-create-next.test.ts`
- `tests/cli.test.ts`

## Tests To Run

- Focused: `pnpm vitest run tests/integration/init-create-next.test.ts tests/cli.test.ts`
- Full validation: `pnpm build`
- Full validation: `pnpm test`

## Old Paths And Bypasses

- Normal create path without `--phase` bypasses this change because it does not pass `currentPhase` and still seeds `FEATURE_SLUG` from task id unless explicit variables override it.
- Direct `YamlTaskStore.createTask()` callers bypass handoff behavior unless they pass `currentPhase`.
- Existing tasks are not migrated; only newly created phase handoff tasks change.

## Risks

- Non-`phase-execution` workflows using `--phase` keep their previous behavior when they do not declare numeric phases or `FEATURE_SLUG`, preserving legacy automation that only used the handoff context and explicit variables.
- Invalid requested phase ids will now fail before task creation instead of creating a task that later renders phase 1. This is the desired safer behavior.

## Rollback Notes

Rollback is straightforward: remove `CreateTaskInput.currentPhase`, restore store default `currentPhase: null`, remove the create flow variable/currentPhase pass-through, and revert test expectations.

## Completion Criteria

- A new `phase-execution` task created with `--phase 2 --from <planningTaskId>` stores `currentPhase: "2"`.
- First rendered prompt shows phase 2.
- Rendered phase file variables use the planning feature slug.
- Context refs remain auto-linked.
- Focused and full validation commands pass.
