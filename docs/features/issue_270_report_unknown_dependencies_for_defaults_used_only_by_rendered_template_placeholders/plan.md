# Issue #270 Implementation Plan

## Ordered Steps

1. Add active-template placeholder discovery to `TemplateRenderer`.
   - Reuse existing template path resolution and recursive include expansion.
   - Share placeholder extraction/filtering with the existing unresolved-placeholder check.
   - Return variable names, not raw `{{TOKEN}}` strings.

2. Thread active-template demand through `PlaySpecCore`.
   - In `renderResolvedPhase()`, call the new renderer discovery method with `definition.template` and `workflow.templateDir`.
   - Pass discovered names into `resolveAndAssertRequiredVariables()`.
   - Keep `assertNextPhaseRequiredVariables()` on declaration-only demand because it does not render an active prompt.

3. Extend `VariableResolver` demand input.
   - Add an optional resolve options object, e.g. `additionalDemandedVariables?: Iterable<string>`.
   - Merge those names into `getDemandedVariableNames()` before `resolveDeclaredDefaults()`.
   - Preserve the current behavior when the option is omitted.

4. Add focused tests.
   - Template renderer: discovers placeholders from the active template and expanded includes.
   - Core/integration: active-template-only `REPORT_FILE` with default `docs/{{MISSING_KEY}}/report.md` throws `UnknownVariableDefaultError`.
   - Resolver regression: unused workflow default with unknown dependency remains non-blocking.

5. Validate.
   - Inspect `package.json` scripts.
   - Run focused unit tests for template renderer and variable resolver.
   - Run the integration/core test touched by the implementation.
   - Run broader `pnpm test` if focused tests pass.
   - Run `pnpm build`.

## Files To Edit

- `src/template/template-renderer.ts`
- `src/template/variable-resolver.ts`
- `src/core/playspec-core.ts`
- `tests/unit/template-renderer.test.ts`
- `tests/unit/variable-resolver.test.ts` or focused integration/core tests as needed

## Old Paths And Bypasses

- Existing declaration-driven demand remains active for required declarations, phase variables, `requiredVariables`, outputs, and output placeholders.
- Direct `VariableResolver.resolve()` calls keep old behavior unless they explicitly provide additional demanded variables.
- Next-phase required-variable assertions remain declaration-based and should not demand placeholders from a phase that is not being rendered.

## Risks

- Over-demanding inactive templates: avoid by discovering only `definition.template` for the current render and its includes.
- Parser drift: avoid by sharing placeholder extraction logic inside `TemplateRenderer`.
- Include behavior mismatch: avoid by using the same `expandIncludes()` path used by render.

## Rollback Notes

The change is local to render-time demand calculation. Reverting the three source files and focused tests restores previous behavior without data migration or state cleanup.

## Completion Criteria

- Active-template-only demanded defaults throw `UnknownVariableDefaultError` for unknown default dependencies.
- Unused defaults with unknown dependencies remain non-blocking.
- Required variables, outputs, phase variables, task overrides, and circular defaults continue passing existing tests.
- Focused tests, full test suite, and build pass or any failure is reported with exact command output.
