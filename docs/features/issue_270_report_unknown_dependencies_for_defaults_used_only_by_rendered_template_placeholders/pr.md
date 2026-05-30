Fixes #270

## Summary

- Treat active phase template placeholders, including placeholders in expanded includes, as demanded variables before resolving defaults.
- Preserve lazy behavior for workflow defaults that are not rendered by the active phase template.
- Add focused unit and integration coverage for renderer discovery, resolver demand plumbing, and `PlaySpecCore.renderNextPrompt()`.

## Why This PR

Prompt rendering could hide the actionable default-dependency failure when a variable was used only by an active template placeholder. A workflow default such as `docs/{{MISSING_KEY}}/report.md` for `REPORT_FILE` could be suppressed as unused, then rendering would fail later with only `{{REPORT_FILE}}` unresolved.

## Problem

`PlaySpecCore.renderResolvedPhase()` resolved variables before `TemplateRenderer` read and expanded the active template. `VariableResolver` therefore considered only declarations, `requiredVariables`, outputs, and output placeholders when deciding which defaults were demanded. Rendered template placeholders were missing from that demand set.

## How It Was Fixed

- `src/template/template-renderer.ts`: added `discoverPlaceholderNames()` using the same template path checks and recursive include expansion used by render.
- `src/template/variable-resolver.ts`: added optional `additionalDemandedVariables` support and merged those names into default-demand calculation.
- `src/core/playspec-core.ts`: discovers placeholders for the active `definition.template` before variable resolution and passes them into the resolver.
- Tests cover active-template demand, expanded include discovery, and the regression that unused broken defaults remain non-blocking.

## Changed Files

- `src/core/playspec-core.ts`
- `src/template/template-renderer.ts`
- `src/template/variable-resolver.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/unit/template-renderer.test.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_270_report_unknown_dependencies_for_defaults_used_only_by_rendered_template_placeholders/spec.md`
- `docs/features/issue_270_report_unknown_dependencies_for_defaults_used_only_by_rendered_template_placeholders/plan.md`
- `docs/features/issue_270_report_unknown_dependencies_for_defaults_used_only_by_rendered_template_placeholders/result.md`
- `docs/features/issue_270_report_unknown_dependencies_for_defaults_used_only_by_rendered_template_placeholders/pr.md`

## Validation

- Passed: `pnpm vitest run tests/unit/template-renderer.test.ts tests/unit/variable-resolver.test.ts tests/integration/init-create-next.test.ts`
- Passed: `pnpm test`
- Passed: `pnpm build`
- Skipped: npm/yarn validation because the repo declares `packageManager: pnpm@9.0.0`.

## PlaySpec Task

- `issue_270_report_unknown_dependencies_for_defaults_used_only_by_rendered_template_placeholders`

## Risks / Follow-Ups

- Placeholder discovery intentionally follows the existing simple-placeholder renderer boundary. It does not add new demand behavior for Handlebars block helper arguments such as `{{#if FLAG}}`.
- Next-phase required-variable checks remain declaration-based because they do not render an active prompt.
