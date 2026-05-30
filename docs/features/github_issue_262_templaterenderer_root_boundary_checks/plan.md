# Implementation plan

## Ordered steps

1. Add failing TemplateRenderer regression coverage in `tests/unit/template-renderer.test.ts`.
   - Add a render test for an in-root top-level template named `..allowed.md`.
   - Add include tests for `{{include:..allowed.md}}` and `{{include:partials/..allowed.md}}`.
   - Preserve the existing `{{include:../outside.md}}` rejection test.

2. Update `src/template/template-renderer.ts`.
   - Replace `relative.startsWith('..')` with the segment-aware predicate already used by workflow loading/editing:
     `relative === '..' || relative.startsWith(\`..${path.sep}\`) || path.isAbsolute(relative)`.
   - Do not change absolute path rejection or include expansion semantics.

3. Run focused validation.
   - Run `pnpm test tests/unit/template-renderer.test.ts`.
   - If this passes, run `pnpm build` because the changed TypeScript source is part of the public package build.

## Files to edit

- `src/template/template-renderer.ts`
- `tests/unit/template-renderer.test.ts`

## Active path and bypass coverage

Top-level templates enter through `TemplateRenderer.render()` and call `resolveTemplatePath()` before file read. Includes enter through `expandIncludes()` and call the same resolver before include file read. The planned tests exercise both entry paths. No alternate renderer path bypass was found.

## Risks

- Main correctness risk: accidentally allowing true parent-directory escapes. The existing escape test remains and focused validation must keep it passing.
- Cross-platform risk: use `path.sep` exactly as existing guards do, preserving platform-specific separator behavior.
- Scope risk: avoid extracting a shared helper unless the narrow predicate replacement proves insufficient.

## Rollback notes

Rollback is a small source/test revert: restore the previous predicate and remove the new in-root `..` prefix tests. No persisted data, migration, or generated artifact compatibility is involved.

## Completion criteria

- Rendering an in-root template named with a `..` prefix succeeds.
- Including an in-root file named with a `..` prefix succeeds.
- Including an in-root path segment named with a `..` prefix succeeds.
- Rendering or including `../outside.md` still throws `IncludePathOutsideRootError`.
- Focused TemplateRenderer tests pass.
- Build passes.
