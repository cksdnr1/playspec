# Implementation Plan

## Ordered Steps

1. Add a failing unit test in `tests/unit/variable-resolver.test.ts`.
   - Model a workflow-level `FUTURE_FILE` default that references missing `FUTURE_KEY`.
   - Make the active phase require only an unrelated available variable.
   - Assert `VariableResolver.resolve()` does not throw and does not expose the unresolved future default.

2. Add coverage for still-needed invalid defaults.
   - Keep the existing unknown default test failing when the bad default is demanded by a phase variable or requirement.
   - Keep the circular default test failing when a needed default participates in a cycle.

3. Update `src/template/variable-resolver.ts`.
   - Keep engine variable construction unchanged.
   - Preserve task variable override semantics: non-empty task variables win; empty task variables can fall back to defaults.
   - Replace the eager `for (const name of Object.keys(declarations)) resolveOne(...)` behavior with demand-driven resolution.
   - Demand variables from phase-local declarations and phase `requiredVariables`.
   - Recursively demand dependencies discovered while rendering a requested default.
   - Continue throwing `UnknownVariableDefaultError` for unknown or empty dependencies in demanded defaults.
   - Continue throwing `CircularVariableDefaultError` for demanded cycles.

4. Avoid core changes unless tests prove active render paths cannot resolve needed phase variables.
   - `PlaySpecCore.renderResolvedPhase()` can keep calling `VariableResolver.resolve()` before `TemplateRenderer.render()`.
   - Active template placeholders for variables that are neither engine, task, nor demanded defaults should still be caught by existing `TemplateRenderer` unresolved-placeholder validation.

5. Run targeted tests first, then full validation.
   - `pnpm test -- tests/unit/variable-resolver.test.ts`
   - `pnpm test`
   - `pnpm build`

6. Record results in `result.md`, then create the PR body in `pr.md`.

## Files To Edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_154_do_not_let_unused_workflow_default_variables_block_unrelated_phase_rendering/result.md`
- `docs/features/issue_154_do_not_let_unused_workflow_default_variables_block_unrelated_phase_rendering/pr.md`

## Tests To Add Or Update

- Add unit coverage for an unused workflow-level default with a missing dependency.
- Add or adjust unit coverage so an unknown default reference still fails when the default is required by the active phase.
- Preserve existing chained default, explicit override, empty override, required-variable, and circular default behavior.
- Add integration coverage only if `PlaySpecCore` changes.

## Active Entry Point Trace

`PlaySpecCore.renderNextPrompt()` -> phase resolution -> `VariableResolver.resolve()` -> demand-driven default resolution -> `assertRequiredVariables()` -> `TemplateRenderer.render()` -> rendered prompt or existing unresolved-placeholder error.

## Old Paths And Bypasses

- Direct resolver callers keep the same `resolve()` API and receive engine variables plus explicit task variables plus demanded defaults.
- Future-phase-only workflow defaults are no longer eagerly materialized.
- Template rendering remains the check for active placeholders not present in the variable map.

## Risks

- A current template placeholder that previously relied on eager workflow default materialization may now be reported by `TemplateRenderer` if it is not also phase-declared or required. This is acceptable only if active phase templates declare required/default variables correctly.
- Workflow-level `required: true` remains global through `assertRequiredVariables()`; the implementation does not change that contract.
- Empty explicit task variables must still allow defaults to resolve for demanded names.

## Rollback Notes

Revert the resolver and unit-test changes. No persisted task data or migration behavior is changed.

## Completion Criteria

- Unused future workflow defaults with missing dependencies do not block unrelated phase resolution.
- Needed unknown default references still throw clearly.
- Needed circular defaults still throw clearly.
- Targeted unit tests, full test suite, and build pass.
