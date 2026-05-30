Fixes #262

## Summary

- Aligns `TemplateRenderer.resolveTemplatePath()` with the segment-aware template-root guard used by workflow path validation.
- Allows valid in-root templates and includes whose basename or path segment begins with `..`.
- Keeps true parent-directory escapes like `../outside.md` rejected.

## Why this PR

`TemplateRenderer` rejected any resolved template-relative path whose string started with `..`. That was stricter than neighboring workflow guards and blocked valid template assets located inside the template root when the filename began with `..`.

## Problem

The old check used `relative.startsWith('..')`, so `..allowed.md` under the template root was treated the same as a real parent-directory escape. The same resolver is used by both top-level template rendering and include expansion, so both paths could reject valid assets.

## How it was fixed

- Changed `src/template/template-renderer.ts` to reject only:
  - the exact parent marker `..`
  - parent-marker path escapes beginning with `..${path.sep}`
  - absolute relative results
- Added `tests/unit/template-renderer.test.ts` coverage for:
  - rendering an in-root top-level `..allowed.md` template
  - including an in-root `..allowed.md`
  - including an in-root `partials/..allowed.md`
  - preserving the existing `../outside.md` escape rejection

## Changed files

- `src/template/template-renderer.ts`
- `tests/unit/template-renderer.test.ts`
- `docs/features/github_issue_262_templaterenderer_root_boundary_checks/spec.md`
- `docs/features/github_issue_262_templaterenderer_root_boundary_checks/plan.md`
- `docs/features/github_issue_262_templaterenderer_root_boundary_checks/result.md`
- `docs/features/github_issue_262_templaterenderer_root_boundary_checks/pr.md`

## Validation

- `pnpm test tests/unit/template-renderer.test.ts` failed before the fix on the new regression tests.
- `pnpm test tests/unit/template-renderer.test.ts` passed after the fix, 9 tests.
- `pnpm build` passed.
- `pnpm test tests/unit/template-renderer.test.ts` reran during focused-test/safe-refactor phases and passed, 9 tests.

## Tests run

- `pnpm test tests/unit/template-renderer.test.ts`
- `pnpm build`

Skipped: full `pnpm test`, because the issue scope is isolated to `TemplateRenderer` path boundary behavior and the focused renderer suite covers the changed active paths.

## PlaySpec task id

`github_issue_262_templaterenderer_root_boundary_checks`

## Risks / follow-ups

None known. The change is limited to the existing renderer guard predicate and focused regression tests.

## Risk notes

The key regression risk was allowing real parent-directory escapes. The existing `../outside.md` include rejection test is preserved and passes with the new predicate.
