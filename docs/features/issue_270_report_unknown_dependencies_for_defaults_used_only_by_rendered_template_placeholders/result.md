# Issue #270 Implementation Result

## Behavior Implemented

- Active phase templates are inspected before prompt variable resolution.
- Placeholders from the active template and its recursively expanded includes are passed into `VariableResolver` as additional demanded variables.
- Defaults for demanded template-rendered variables now fail with `UnknownVariableDefaultError` when they reference unknown dependencies.
- Truly unused workflow defaults with unknown dependencies remain non-blocking.

## Files Changed

- `src/template/template-renderer.ts`
- `src/template/variable-resolver.ts`
- `src/core/playspec-core.ts`
- `tests/unit/template-renderer.test.ts`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_270_report_unknown_dependencies_for_defaults_used_only_by_rendered_template_placeholders/spec.md`
- `docs/features/issue_270_report_unknown_dependencies_for_defaults_used_only_by_rendered_template_placeholders/plan.md`

## Verification

Passed:

- `pnpm vitest run tests/unit/template-renderer.test.ts tests/unit/variable-resolver.test.ts tests/integration/init-create-next.test.ts`
- `pnpm test`
- `pnpm build`

Skipped:

- No package-manager alternatives were run because `package.json` declares `packageManager: pnpm@9.0.0` and no npm lockfile is present.

## Remaining Risks

- Placeholder discovery intentionally matches the existing renderer behavior for simple placeholders. It does not add demand for Handlebars block helper arguments such as `{{#if FLAG}}`, matching the current unresolved-placeholder filtering boundary.
- The active-template demand path is only used for prompt rendering; next-phase required-variable checks remain declaration-based by design.

## Refactor Review

- No additional refactor was applied after implementation. The changed code is already localized to renderer discovery, resolver demand plumbing, and prompt-render core wiring.
- Skipped broader renderer/parser changes because they would expand behavior beyond the issue scope.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/271
- Reusable agent guidance: no new guidance needed. Existing AGENTS.md rules and mono-spec workflow were sufficient for this scoped bug fix.
