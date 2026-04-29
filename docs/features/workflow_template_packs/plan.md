# Workflow Template Packs Implementation Plan

## Ordered Steps

1. Add pack data model and path utilities.
   - Edit `package.json`, `tsconfig.json`, `src/utils/paths.ts`.
   - Add `src/pack/pack-schema.ts`, `src/pack/pack-registry.ts`,
     `src/pack/pack-installer.ts`, and `src/pack/index.ts`.
   - User-visible chain: `playspec pack validate/install/list/show/export/remove`
     reads or mutates only the user pack store outside project `.playspec`.

2. Extend task/workflow schemas.
   - Edit `src/core/types.ts` and `src/core/schemas.ts`.
   - Add `workflowPack`, declarative variable definitions, and workflow
     artifacts.
   - Keep all new fields optional so old task YAML and workflows still parse.

3. Wire workflow and template asset resolution.
   - Edit `src/workflow/workflow-loader.ts`,
     `src/template/template-renderer.ts`, `src/template/template-loader.ts`,
     and `src/core/playspec-core.ts`.
   - Preserve the existing `.playspec` default path when no pack context is
     supplied.
   - Resolve task pack refs through the registry before rendering.

4. Implement layered declarative variables.
   - Edit `src/template/variable-resolver.ts`.
   - Keep engine and legacy compatibility defaults.
   - Add pack/workflow/phase defaults evaluated as deterministic Handlebars
     templates.
   - Fail clearly on unknown default placeholders and cycles.

5. Add pack CLI and create integration.
   - Edit `src/cli/index.ts`, `src/cli/commands/create.ts`, and add
     `src/cli/commands/pack.ts`.
   - Store `workflowPack` for `playspec create <workflow> <title> --pack <id>`.
   - Resolve phase-execution planning artifacts from workflow metadata first,
     then legacy formulas.

6. Update relevant-file discovery.
   - Edit `src/core/relevant-files.ts`.
   - Include workflow artifacts as path candidates and render prompts through
     the correct template source.

7. Add default pack manifest.
   - Add `src/preset/assets/default/playspec-pack.yaml`.
   - Declare legacy/default variables in the manifest so the built-in pack is
     exportable and old workflows stay compatible.

8. Add and update tests.
   - Unit: pack schema, variable layering, cycle/unknown default errors,
     template include roots.
   - Integration: install local pack, create task with `--pack`, render custom
     variable prompt, old default prompt compatibility, artifact linking.
   - CLI: `pack validate`, `install`, `list`, `show`, `export`, `remove`, and
     `create --pack`.

## Files To Edit

- `package.json`
- `tsconfig.json`
- `src/utils/paths.ts`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/errors.ts`
- `src/storage/yaml-task-store.ts`
- `src/workflow/workflow-loader.ts`
- `src/template/variable-resolver.ts`
- `src/template/template-renderer.ts`
- `src/template/template-loader.ts`
- `src/core/playspec-core.ts`
- `src/cli/index.ts`
- `src/cli/commands/create.ts`
- `src/cli/commands/pack.ts`
- `src/core/relevant-files.ts`
- `src/preset/assets/default/playspec-pack.yaml`
- focused tests under `tests/unit`, `tests/integration`, and `tests/cli.test.ts`

## Risks

- Archive extraction must prevent path traversal. Use `tar` with controlled
  extraction into a temp directory and validate the resulting manifest before
  copying.
- Installed pack lookup needs deterministic latest-version selection when only
  a pack id is supplied.
- Template includes must remain restricted to allowed roots.
- Old tests may instantiate `WorkflowLoader`, `TemplateRenderer`, or
  `VariableResolver` directly; new parameters must be optional.

## Rollback Notes

- All pack installs live outside `.playspec`; removing the user pack directory
  restores prior behavior for project-local workflows.
- Optional schema fields mean task YAML migrations are not required for rollback.
- Existing `.playspec/workflows` and `.playspec/templates` remain the fallback
  compatibility path.

## Completion Criteria

- `playspec pack validate/install/list/show/export/remove` work for local packs.
- `playspec create custom-workflow "Title" --pack custom-pack` persists
  `workflowPack`.
- Prompt rendering uses installed pack workflow/templates and pack-defined
  variables.
- Required unresolved declared variables fail with actionable errors.
- Old mono-spec and total-plan tasks still render.
- Phase-execution links declared artifacts when present and legacy files when
  absent.
- `pnpm build`, `pnpm test`, and `pnpm dev desync-check` pass.

## Validation Risk Ledger

Blockers:

- None.

Medium risks:

- Archive install/export can accidentally permit path traversal if extraction is
  not constrained. Minimal patch: extract to a temp directory, inspect resulting
  paths, and validate `playspec-pack.yaml` before copying into the user store.
- Direct callers may still use `.playspec`-only constructors. Minimal patch:
  make pack-aware parameters optional and keep `.playspec` behavior as the
  default path.
- Variable defaults can hide cycles through indirect references. Minimal patch:
  resolve declarative variables with a dependency walk and report the cycle.

Low risks:

- Latest-version selection is lexical/semver-like but not a package manager.
  Minimal patch: sort installed version directory names deterministically and
  store the selected version on new tasks.
- Built-in/default pack export may need to read from source assets during `pnpm
  dev` and dist assets after build. Minimal patch: derive paths from
  `import.meta.url` and keep the existing build asset copy.

Unresolved blockers after fixes:

- None.

Gate decision:

- `approved`. The plan is scoped to issue #30, preserves compatibility paths,
  and includes active entry points, persistence, propagation, user-visible
  commands, and verification.
