# PR Body

Fixes #150

## Summary

- Keep `UnknownVariableDefaultError` for default placeholders that are not declared anywhere.
- Allow declared-but-unset default dependencies to resolve as empty during default expansion so required-variable validation can report the missing input accurately.
- Add unit and integration coverage for indirect missing required variables.

## Changed Files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/report_missing_known_default_dependencies_as_missing_required_variables/spec.md`
- `docs/features/report_missing_known_default_dependencies_as_missing_required_variables/plan.md`
- `docs/features/report_missing_known_default_dependencies_as_missing_required_variables/result.md`
- `docs/features/report_missing_known_default_dependencies_as_missing_required_variables/pr.md`

## Tests Run

- `pnpm install`
- `pnpm test -- tests/unit/variable-resolver.test.ts tests/integration/init-create-next.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

`report_missing_known_default_dependencies_as_missing_required_variables`

## Risk Notes

- Optional declared dependencies referenced by defaults now render with empty substitution instead of being mislabeled as unknown. Required dependencies remain rejected by `MissingRequiredVariablesError`.
- No reusable agent guidance update is needed; this was a focused resolver behavior fix.
