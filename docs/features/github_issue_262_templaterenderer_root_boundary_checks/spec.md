# GitHub issue #262 TemplateRenderer root boundary checks

## Scope

Align `TemplateRenderer` template-root escape detection with the segment-aware path boundary guard already used by workflow loading, workflow editing, and relevant-file discovery. Add focused regression tests for in-root template and include paths whose basename or path segment begins with `..`.

Out of scope: redesigning template path syntax, changing absolute path rejection, changing workflow-loader/editor/relevant-file behavior, or modifying unrelated report path/artifact behavior.

## Use Case alignment

Workflow authors should be able to keep valid template assets under a workflow `templates` directory even when an asset basename or internal path segment begins with `..`. The renderer should reject only real escapes from the template root, such as `../outside.md`, and absolute template/include paths.

## High-level current implementation summary

Verified in `src/template/template-renderer.ts`: `TemplateRenderer.render()` resolves the requested template path, reads it, expands `{{include:...}}` directives recursively, checks unresolved placeholders, and renders with Handlebars. Both top-level template paths and include paths flow through `resolveTemplatePath()`.

Verified in neighboring guards:

- `src/workflow/workflow-loader.ts` rejects paths when `relative === '..'`, `relative.startsWith(\`..${path.sep}\`)`, or `path.isAbsolute(relative)`.
- `src/workflow/workflow-editor.ts` uses the same segment-aware predicate.
- `src/core/relevant-files.ts` uses the same segment-aware predicate for workspace path boundaries.

## Relevant files reviewed

- `src/template/template-renderer.ts`
- `tests/unit/template-renderer.test.ts`
- `src/workflow/workflow-loader.ts`
- `src/workflow/workflow-editor.ts`
- `src/core/relevant-files.ts`
- `.playspec/workflows/mono-spec/workflow.yaml`

## Active entry points and bypasses

Active entry point: `TemplateRenderer.render(templatePath, variables, templateRoot)`.

Path validation path:

1. `render()` calls private `resolveTemplatePath()` for the top-level `templatePath`.
2. `expandIncludes()` calls the same private `resolveTemplatePath()` for each `{{include:...}}` path.
3. Resolved files are read only after the guard succeeds.

No alternate template/include path resolution bypass was found in `TemplateRenderer`.

## Current architecture

The renderer computes an absolute candidate path with `path.resolve(templateRoot, templatePath)`, then computes `path.relative(templateRoot, resolvedTemplatePath)`. The intended boundary check is based on the relative path from the root back to the candidate.

Current renderer problem: it rejects any relative string beginning with `..`. That catches true escapes but also catches in-root names like `..allowed.md` or `partials/..allowed.md`.

## Verified behavior

Verified by code inspection:

- `../outside.md` resolves outside `templateRoot` and produces a relative path beginning with the parent marker.
- `..allowed.md` resolves inside `templateRoot` but also begins with the string `..`.
- `partials/..allowed.md` resolves inside `templateRoot`; the relative path does not begin with `..`, but this should be covered for include segment behavior.
- Absolute paths are rejected before resolution in `TemplateRenderer.resolveTemplatePath()`.

Existing tests cover true include escape rejection through `../outside.md`, but do not cover in-root `..` prefix filenames.

## Problems

The renderer's broad string-prefix guard is inconsistent with nearby workflow path guards and rejects valid in-root assets. Because the same helper is used for top-level templates and includes, both flows need regression coverage.

## Proposed direction

Replace the renderer boundary predicate with:

```ts
relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
```

This keeps true parent-directory escapes and absolute paths rejected while allowing in-root basenames or segments that merely start with `..`.

## File-by-file plan

- `src/template/template-renderer.ts`: update only the private boundary check in `resolveTemplatePath()`.
- `tests/unit/template-renderer.test.ts`: add focused tests that rendering `..allowed.md` succeeds, including `..allowed.md` succeeds, including an in-root path segment like `partials/..allowed.md` succeeds, and existing `../outside.md` rejection remains.

## Risks and open questions

Risk is low because the change narrows an over-broad predicate to the same predicate already used in adjacent path guards. The key regression risk is accidentally allowing true parent-directory escapes, so tests must preserve explicit `../outside.md` rejection coverage.

Open question: none for issue scope.

## Reader aids

Segment-aware guard meaning:

- Reject exact parent marker: `..`
- Reject parent marker followed by a path separator: `../x`
- Reject absolute relative results, which can occur across roots/drives on some platforms
- Allow ordinary in-root filenames or path segments that merely start with the characters `..`
