# Issue 194 Implementation Plan

## Ordered Steps

1. Add shared declaration merge semantics.
   - Edit `src/template/variable-resolver.ts`.
   - Add an exported `mergeVariableDeclarations()` helper near the resolver internals.
   - Merge per variable: workflow declaration first, phase declaration second.
   - Preserve workflow fields when the phase omits them.
   - Let explicit phase fields override workflow fields, including `default`, `description`, and explicit `required: false`.

2. Use the helper in default resolution.
   - Replace the whole-object spread in `VariableResolver.resolve()` with `mergeVariableDeclarations(workflow?.variables, definition?.variables)`.
   - Keep task variable precedence unchanged: engine variables, resolved defaults, then non-empty task variables.
   - Keep unknown default and circular default behavior unchanged.

3. Use the same merged declarations for render required validation.
   - Update `src/core/required-variables.ts` to accept the effective declaration map, or otherwise avoid recomputing workflow and phase requirements separately.
   - Update `src/core/playspec-core.ts` so `resolveAndAssertRequiredVariables()` builds one effective declaration map and passes it to `assertRequiredVariables()`.
   - Update `src/cli/commands/create.ts` if its validation call uses the old signature.

4. Add resolver unit coverage.
   - Edit `tests/unit/variable-resolver.test.ts`.
   - Add a test proving a same-name phase declaration can override a workflow default while inheriting other metadata.
   - Keep existing tests for explicit task overrides, empty task variable fallback, unknown default references, circular defaults, and unused future defaults passing.

5. Add render-path required validation coverage.
   - Edit `tests/integration/init-create-next.test.ts`.
   - Add or extend a test workflow where `PROJECT_KEY` is workflow-level `required: true` and the phase declares `PROJECT_KEY` with only `description`, then assert rendering fails with `MissingRequiredVariablesError`.
   - Add coverage that a phase same-name `default` still resolves successfully when no task value is set.

6. Validate.
   - Run focused tests:
     - `pnpm exec vitest run tests/unit/variable-resolver.test.ts`
     - `pnpm exec vitest run tests/integration/init-create-next.test.ts -t "required"`
   - Run full validation:
     - `pnpm build`
     - `pnpm test`

## Files To Edit

- `src/template/variable-resolver.ts`
- `src/core/required-variables.ts`
- `src/core/playspec-core.ts`
- `src/cli/commands/create.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_194_variable_required_metadata/result.md`
- `docs/features/issue_194_variable_required_metadata/pr.md`

## Tests To Add Or Update

- Resolver unit test:
  - Workflow declaration: `PROJECT_KEY: { required: true, default: "workflow", description: "Workflow" }`
  - Phase declaration: `PROJECT_KEY: { default: "phase" }`
  - Expected resolved value: `phase`
  - Purpose: prove phase default override still works while same-name declarations are merged per field.

- Render-path integration test:
  - Workflow declaration: `PROJECT_KEY: { required: true }`
  - Phase declaration: `PROJECT_KEY: { description: "Phase label only" }`
  - No task `PROJECT_KEY`.
  - Expected: prompt rendering rejects with `MissingRequiredVariablesError`.

- Optional explicit relaxation test if implemented:
  - Workflow declaration: `PROJECT_KEY: { required: true }`
  - Phase declaration: `PROJECT_KEY: { required: false, default: "" }`
  - Expected: required validation follows the explicit phase override contract.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: object spread in `VariableResolver.resolve()` must be removed.
- Bypass path: `assertRequiredVariables()` callers must not keep separate workflow/phase required logic that disagrees with resolver merging.
- Partial migration risk: CLI create validation can use `assertRequiredVariables()` independently of `PlaySpecCore`; update its call if the helper signature changes.

## Risks

- Explicit `required: false` support changes behavior from "workflow required always wins" to "phase can intentionally relax." This should be covered by tests so it is not an accidental object-spread side effect.
- Required-variable lists in `definition.requiredVariables` remain mandatory regardless of declaration metadata. Do not change that behavior.
- Do not change task variable value precedence or fallback behavior for empty task variable values.

## Rollback Notes

Rollback is limited to the listed source/test/doc files. Reverting the merge helper and test additions restores previous whole-object replacement behavior.

## Completion Criteria

- Same-name workflow/phase declarations are merged per field.
- Workflow `required: true` is preserved when phase declarations only supply `default` or `description`.
- Phase-specific defaults still override workflow defaults.
- Required validation uses the same effective declaration metadata as default resolution.
- Focused and full test suites pass.
