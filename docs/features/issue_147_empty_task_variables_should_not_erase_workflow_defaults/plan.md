# Issue 147 Implementation Plan

## Ordered Steps

1. Add the failing unit coverage in `tests/unit/variable-resolver.test.ts`.
   - Create a workflow variable declaration with `required: true` and a non-empty `default`.
   - Create a task with the same variable stored as `""`.
   - Assert `VariableResolver.resolve()` returns the declaration default.
   - Keep existing non-empty override tests unchanged.

2. Add render-path integration coverage in `tests/integration/init-create-next.test.ts`.
   - Initialize a temp workspace with default preset.
   - Replace the test `multi-spec` workflow with a single phase whose workflow variable is both required and defaulted.
   - Use a template that renders the variable.
   - Create a task with that variable stored as `""`.
   - Assert `PlaySpecCore.renderNextPrompt()` does not throw `MissingRequiredVariablesError` and includes the default value.

3. Fix `src/template/variable-resolver.ts`.
   - Preserve current default resolution behavior, including dependency resolution against task variables.
   - Build a non-empty task variable overlay from `task.variables`.
   - Return `{ ...engineVariables, ...resolvedDefaults, ...nonEmptyTaskVariables }`.
   - Do not change `assertRequiredVariables()`.

4. Run targeted validation.
   - `pnpm exec vitest run tests/unit/variable-resolver.test.ts tests/integration/init-create-next.test.ts`
   - Then run repository validation:
     - `pnpm build`
     - `pnpm test`

5. Record result and PR artifacts.
   - Write `result.md` with commands, outcomes, changed files, and risk notes.
   - Write `pr.md` with the draft PR body content.

## Files To Edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/result.md`
- `docs/features/issue_147_empty_task_variables_should_not_erase_workflow_defaults/pr.md`

## Tests To Add Or Update

- Unit: empty task variable no longer overrides a declaration default.
- Integration: required variable with declaration default and stored empty task value renders without `MissingRequiredVariablesError`.

Existing tests that must keep passing:

- Non-empty explicit override behavior.
- Unknown default reference errors.
- Circular default reference errors.
- Missing required variable errors.

## Active Entry Point Trace

`PlaySpecCore.renderNextPrompt(taskId)` -> workflow and phase resolution -> `VariableResolver.resolve()` -> required-variable validation -> `TemplateRenderer.render()`.

The fix changes the resolved variable map before validation and rendering. No persistence, reset, migration, MCP, or CLI routing behavior changes.

## Old Paths And Bypass Paths

- Direct `VariableResolver.resolve()` callers receive the corrected map through the same API.
- Prompt rendering no longer sees an empty task variable when a declaration default resolved a non-empty value.
- Required-variable validation remains unchanged and still rejects variables that are truly absent or empty after resolution.

## Risks

- Optional variables that callers intentionally blanked with `NAME=""` will now fall back to defaults when a declaration default exists. This matches the existing default resolver treatment of empty task variables as unresolved.

## Rollback Notes

The change is limited to one merge operation and two focused tests. Rollback is reverting the resolver overlay change and the new tests.

## Completion Criteria

- The new unit test fails on the old final spread behavior and passes with the fix.
- The new integration test proves required validation no longer rejects a default-backed variable because of a stored empty value.
- `pnpm build` and `pnpm test` pass.
