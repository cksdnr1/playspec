# Issue #293 Implementation Plan

## Ordered Steps

1. Update the package build script in `package.json`.
   - Change the asset copy tail from overlay-only copy to: remove `dist/preset/assets`, recreate it, copy `src/preset/assets/.` into it.
   - Keep the cleanup scoped to `dist/preset/assets`; do not delete all of `dist`.
   - Keep `prepack` unchanged so `pnpm pack` continues to use the shared `pnpm build` path.

2. Extend package artifact regression coverage in `tests/integration/package-artifact.test.ts`.
   - Add helpers to seed stale copied preset assets under `dist/preset/assets`.
   - Seed both:
     - a stale workflow directory: `dist/preset/assets/workflows/stale-workflow/workflow.yaml`
     - a stale template under an existing workflow: `dist/preset/assets/workflows/mono-spec/templates/stale_template.md`
   - Run the same packaging path already used by the test through `packRepository()`, which invokes `pnpm pack` and therefore `prepack` -> `pnpm build`.
   - Assert both stale paths are gone from the repository `dist` after packing.
   - Assert stale paths are absent from the installed package.
   - Keep existing assertions that compiled bins and current `mono-spec` workflow assets exist.

3. Validate locally.
   - Run `pnpm test:package-artifact`.
   - Run `pnpm build`.
   - Run `pnpm test` if runtime permits; otherwise report the focused validation and any skipped command explicitly.

4. Record result and PR notes.
   - Update `result.md` with changed files, tests run, and residual risk.
   - Update `pr.md` with the draft PR body content required by the queue.

## Files To Edit

- `package.json`
- `tests/integration/package-artifact.test.ts`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/result.md`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/pr.md`

## Tests To Add Or Update

- Extend `tests/integration/package-artifact.test.ts` to cover stale asset cleanup during `pnpm pack`.
- Existing package artifact assertions continue to verify installed compiled bins and source preset assets.

## Active Entry Point Trace

- Entry point: `pnpm pack`
- Build trigger: `prepack` runs `pnpm build`
- Data update: `pnpm build` removes and recreates `dist/preset/assets`
- Propagation: fresh source assets are copied from `src/preset/assets`
- User-visible result: installed package contains current built-in workflow assets and does not contain stale workflow/template files

Direct `pnpm build` follows the same cleanup/copy script without the pack/install steps.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path to close: overlay-only `cp -R` into an existing `dist/preset/assets` tree.
- Bypass path to avoid: changing `prepack` separately from `build`; keep both using the same build script.
- Partial migration risk: stale files could be removed from repository `dist` but still included in tarball if cleanup happens after packing. The regression must assert both repository `dist` and installed package contents.
- Mutation boundary: only `dist/preset/assets` may be removed.

## Rollback Notes

- Revert the `package.json` build script edit and the package artifact test changes.
- No source assets, project workflows, user workflows, migration state, or MCP behavior are modified.

## Completion Criteria

- Stale workflow directory seeded under `dist/preset/assets/workflows` is removed by the build/package path.
- Stale template file seeded under `dist/preset/assets/workflows/mono-spec/templates` is removed by the build/package path.
- Current source preset assets still appear in the installed package.
- Focused package artifact test passes.
- Build passes.
