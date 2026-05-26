# GitHub Issue #231 Optional Phase Defaults Plan

## Ordered Implementation Steps

1. Add focused failing coverage in `tests/unit/variable-resolver.test.ts`.
   - Optional phase-local variable with `required: false` and `default: "docs/{{MISSING_KEY}}/report.md"` must not throw when it is not in `requiredVariables` or `outputs`.
   - Phase-local variable listed in `requiredVariables` must still throw `UnknownVariableDefaultError` for an unknown default dependency.
   - Phase-local variable listed in `outputs` must still throw `UnknownVariableDefaultError` for an unknown default dependency.

2. Update `src/template/variable-resolver.ts`.
   - Keep `required: true` declarations demanded.
   - For active `definition.variables`, only demand the variable from declaration presence when the merged declaration is not explicitly `required: false`.
   - Keep `definition.requiredVariables` and `definition.outputs` as explicit demand sources.
   - Do not change `resolveDeclaredDefaults()` circular detection, empty task variable behavior, task override behavior, or unknown dependency suppression for non-demanded defaults.

3. Run focused validation.
   - `pnpm vitest run tests/unit/variable-resolver.test.ts`

4. Run broader relevant validation because this is a shared resolver.
   - `pnpm test`
   - `pnpm build`

## Files To Edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/github_issue_231_optional_phase_defaults/result.md`
- `docs/features/github_issue_231_optional_phase_defaults/pr.md`

## Tests To Add Or Update

- Add one test for the optional phase declaration deferral behavior.
- Add or update tests for `requiredVariables` and `outputs` demanding phase-local defaults with unknown dependencies.
- Existing circular default and empty task variable tests should remain unchanged and passing.

## Active Entry Point Trace

- Entry point: `VariableResolver.resolve(task, phaseId, workflow, definition)`.
- State/data update: merged declaration map and demanded variable set.
- Propagation: `resolveDeclaredDefaults()` receives the demanded set and decides whether unknown default dependencies are fatal or deferred.
- User-visible behavior: prompt rendering no longer fails for unused explicit optional phase helper defaults, while required/defaulted phase variables still fail clearly.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: all active phase variables are demanded by declaration presence.
- Intended new path: explicit optional phase variables are not demanded by declaration presence alone.
- Bypasses preserved: non-empty task variables, explicit empty task variables falling back to defaults, workflow-level default deferral, circular default detection.
- Partial migration risk: templates may render optional variables without listing them in metadata. The narrow implementation preserves conservative demand for phase declarations unless they explicitly set `required: false`.

## Rollback Notes

Rollback is a one-line demand calculation change plus test removal. No migration, persistence change, or generated runtime asset change is involved.

## Completion Criteria

- Optional explicit phase variable defaults with unknown dependencies are deferred when not demanded.
- `requiredVariables` and `outputs` continue to force clear `UnknownVariableDefaultError` failures.
- Focused resolver test passes.
- Full relevant test/build validation passes or any failure is reported with details.
