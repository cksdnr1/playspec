# Issue #293 Result

## Behavior Implemented

- `pnpm build` now removes only `dist/preset/assets` before recreating it and copying `src/preset/assets`.
- `pnpm pack` continues to use `prepack` -> `pnpm build`, so package artifacts use the same cleanup path.
- Package artifact coverage now seeds stale copied preset assets before packing:
  - `dist/preset/assets/workflows/stale-workflow/workflow.yaml`
  - `dist/preset/assets/workflows/mono-spec/templates/stale_template.md`
- The test asserts the stale assets are removed from repository `dist` after packing and absent from the installed package.
- Existing package artifact assertions still verify compiled bins and current `mono-spec` source assets are included.

## Files Changed

- `package.json`
- `tests/integration/package-artifact.test.ts`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/spec.md`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/plan.md`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/result.md`

## Verification

- `pnpm test:package-artifact` passed.
- `pnpm build` passed.
- `pnpm test` passed: 32 test files, 673 tests.

## Remaining Risks

- The build script remains POSIX-shell based, consistent with the previous `mkdir`/`cp` implementation.
- Cleanup is intentionally scoped to `dist/preset/assets`; other stale compiled files in `dist` are outside this issue.
- Safe-refactor review found no additional local cleanup worth applying beyond the scoped implementation.
- No reusable agent guidance update is needed; this was a local package build regression.
- PR link: https://github.com/cksdnr1/playspec/pull/294
