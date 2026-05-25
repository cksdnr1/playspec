# Implementation Plan

## Ordered Steps

1. Add feedback config schemas in `src/core/schemas.ts`.
   - Define closed enums for `kind`, `thresholdMode`, `onFailure`, storage mode, compact history policy shape, proposal readiness mode, workflow source kind, and path kind.
   - Validate score thresholds as numbers from `0` through `100`.
   - Validate compact history counts as positive integers and refine `keepLatest <= maxEntries`.
   - Attach `feedback` as optional metadata on `PhaseDefinitionSchema`.

2. Add matching TypeScript types in `src/core/types.ts`.
   - Export reusable literal union types for feedback policies.
   - Add `PhaseFeedbackConfig` and nested interfaces.
   - Add `feedback?: PhaseFeedbackConfig` to `PhaseDefinition`.

3. Add workflow-level phase reference validation in `src/workflow/workflow-loader.ts`.
   - During `validateWorkflowDefinition()`, check any phase `feedback` references existing `sourcePhaseId`, `evaluatedArtifactPhaseId`, and `evolutionTargetPhaseId`.
   - Keep template validation unchanged.
   - Do not validate target file existence, path writability, score parsing, or evolution storage in this phase.

4. Add focused integration tests in `tests/integration/workflow-loader.test.ts`.
   - Valid workflow with feedback config loads.
   - Workflow without feedback config still loads.
   - Separate source/evaluated/target phase IDs are preserved.
   - Invalid threshold, feedback kind, failure policy, storage mode, compact history policy, proposal readiness policy, workflow source kind, and path kind fail validation.
   - Missing referenced phase IDs fail loader validation.
   - Required variable resolution remains unchanged.

5. Run validation.
   - `pnpm build`
   - `pnpm test`

## Files To Edit

- `src/core/schemas.ts`
- `src/core/types.ts`
- `src/workflow/workflow-loader.ts`
- `tests/integration/workflow-loader.test.ts`
- `docs/features/github_issue_195_phase_validation_feedback_config_schema/result.md`
- `docs/features/github_issue_195_phase_validation_feedback_config_schema/pr.md`

## Old Paths, Bypasses, And Partial Migration Risks

- Existing workflow YAML without `feedback` must remain valid because the new field is optional.
- Any direct `WorkflowDefinitionSchema.parse()` call should receive the same schema guarantees.
- Loader-only validation is needed for phase IDs because `PhaseDefinitionSchema` cannot see sibling phase keys.
- Workflow editor code that parses full workflow definitions should accept the optional field through the shared schema.
- Required variable resolution must not inspect or depend on `feedback`.

## Risks

- Over-validating target file paths at workflow load time would make builtin or portable workflows brittle. Keep those as structured strings only for Phase 1.
- Adding broad string unions too loosely would miss invalid config. Use closed enums for requested policies.
- Adding defaults could make later behavior implicit. Require explicit values inside a present feedback block unless the issue specifically asked for optional/backward-compatible top-level config.

## Rollback Notes

The change is contained to schema/type additions, loader validation, and tests. Rollback is a normal git revert of the implementation commit; no migration, generated store, or persisted runtime state is introduced.

## Completion Criteria

- Workflows with and without feedback config load.
- Invalid requested enum/policy/threshold/path-kind values fail.
- Missing referenced phase IDs fail at workflow validation time.
- Separate source validation, evaluated artifact, and evolution target phases are represented and preserved.
- Required variable resolution tests still pass.
- `pnpm build` and `pnpm test` pass.
