# Implementation Plan

## Ordered Steps

1. Add a failing unit test in `tests/unit/variable-resolver.test.ts`.
   - Define a workflow variable `PROJECT_KEY` with `required: true`.
   - Define `OUTPUT_FILE` with default `docs/{{PROJECT_KEY}}/out.md`.
   - Resolve a task that omits `PROJECT_KEY`.
   - Verify resolver does not throw `UnknownVariableDefaultError` and returns `OUTPUT_FILE` with an empty substitution.

2. Add an integration test in `tests/integration/init-create-next.test.ts`.
   - Initialize a temporary default workspace.
   - Replace a test workflow with a phase that requires `PROJECT_KEY` and uses `OUTPUT_FILE` in its template.
   - Declare `OUTPUT_FILE` default as `docs/{{PROJECT_KEY}}/out.md`.
   - Create a task without `PROJECT_KEY`.
   - Verify `PlaySpecCore.renderNextPrompt()` rejects with `MissingRequiredVariablesError`.

3. Update `src/template/variable-resolver.ts`.
   - Keep unknown placeholder detection in the lookup callback using `knownVariables`.
   - Remove the empty-string check in `renderDefault()` that throws `UnknownVariableDefaultError`.
   - Preserve circular default detection and default chaining.

4. Run targeted validation.
   - `pnpm test -- tests/unit/variable-resolver.test.ts tests/integration/init-create-next.test.ts`
   - If targeted validation passes, run `pnpm build` and full `pnpm test`.

## Files To Edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/report_missing_known_default_dependencies_as_missing_required_variables/result.md`
- `docs/features/report_missing_known_default_dependencies_as_missing_required_variables/pr.md`

## Tests To Add Or Update

- Unit: declared required dependency referenced by another default is known even when unset.
- Integration: prompt rendering reports `MissingRequiredVariablesError` for missing declared input referenced indirectly through a default.
- Existing tests retained: unknown default reference, circular defaults, explicit overrides, chained defaults, direct missing required variable validation.

## Risks

- Optional declared dependencies referenced by defaults will render as empty strings. Required dependencies still fail through `assertRequiredVariables()`.
- A too-broad resolver change could weaken unknown-placeholder detection; targeted unit coverage must keep that behavior pinned.

## Rollback Notes

The implementation is a small resolver behavior change plus tests. Reverting the resolver hunk and the two new tests restores prior behavior.

## Completion Criteria

- Unknown undeclared default placeholders still throw `UnknownVariableDefaultError`.
- Declared required missing dependencies do not throw `UnknownVariableDefaultError` during default resolution.
- Prompt rendering surfaces missing required values as `MissingRequiredVariablesError`.
- Targeted tests, build, and full test suite pass.
