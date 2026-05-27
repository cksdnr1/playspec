Fixes #259

## Summary

- Treats `FEATURE_SLUG: ""` as unset before workflow variable defaults are resolved.
- Preserves explicit non-empty `FEATURE_SLUG` overrides.
- Adds unit coverage proving defaults that reference `FEATURE_SLUG` render with the title-derived slug.

## Why this PR

Task records can contain an empty stored `FEATURE_SLUG`, especially when task YAML is manually edited or comes from older data. The resolver already treats empty declared task variables as unset for workflow defaults, but `FEATURE_SLUG` was computed through a separate engine-variable path. That made empty `FEATURE_SLUG` inconsistent with absent `FEATURE_SLUG`.

## Problem

`VariableResolver.resolve` derived `FEATURE_SLUG` with a nullish fallback. An empty string was accepted as the engine value, then the raw empty task variable was also merged into default resolution. Workflow defaults such as `PHASE_SPEC_FILE` and `PHASE_HANDOFF_FILE` could render malformed paths with blank slug segments.

## How it was fixed

- `src/template/variable-resolver.ts`
  - Added explicit `resolveFeatureSlug` behavior for absent-or-empty `FEATURE_SLUG`.
  - Filters an empty `FEATURE_SLUG` task override before calling `resolveDeclaredDefaults`, so defaults use the derived engine slug.
- `tests/unit/variable-resolver.test.ts`
  - Adds regression coverage for `FEATURE_SLUG: ""`.
  - Asserts both returned `FEATURE_SLUG` and `PHASE_SPEC_FILE` / `PHASE_HANDOFF_FILE` defaults use the derived slug.

## Validation

- `pnpm test -- tests/unit/variable-resolver.test.ts` passed: 30 tests.
- `pnpm build` passed.
- `pnpm test` passed: 30 test files, 606 tests.
- After safe refactor, `pnpm build` passed.
- After safe refactor, `pnpm test` passed: 30 test files, 606 tests.
- Skipped checks: none.

## Risks / follow-ups

- Whitespace-only `FEATURE_SLUG` values remain explicit overrides; this PR only treats exact empty strings as unset.
- Callers intentionally using `FEATURE_SLUG: ""` for blank path segments will now receive the title-derived slug.

## Changed files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_259_empty_feature_slug_should_fall_back_before_resolving_workflow_defaults/spec.md`
- `docs/features/issue_259_empty_feature_slug_should_fall_back_before_resolving_workflow_defaults/plan.md`
- `docs/features/issue_259_empty_feature_slug_should_fall_back_before_resolving_workflow_defaults/result.md`
- `docs/features/issue_259_empty_feature_slug_should_fall_back_before_resolving_workflow_defaults/pr.md`

## PlaySpec task

`issue_259_empty_feature_slug_should_fall_back_before_resolving_workflow_defaults`
