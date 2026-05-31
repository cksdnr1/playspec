# Draft PR

PR: https://github.com/cksdnr1/playspec/pull/294

Fixes #293

## Summary

- Clean `dist/preset/assets` before copying source preset assets during `pnpm build`.
- Extend package artifact coverage to seed stale copied workflow/template assets before packing.
- Assert stale assets are removed from repository `dist`, absent from the installed package, and current built-in workflow assets still install.

## Changed Files

- `package.json`
- `tests/integration/package-artifact.test.ts`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/spec.md`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/plan.md`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/result.md`
- `docs/features/issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds/pr.md`

## Tests Run

- `pnpm test:package-artifact`
- `pnpm build`
- `pnpm test`
- `pnpm test:package-artifact` after safe-refactor review

## PlaySpec Task ID

`issue_293_clean_preset_assets_before_copying_them_into_dist_during_package_builds`

## Risk Notes

- Cleanup is scoped to `dist/preset/assets`; it does not remove all of `dist`, source assets, project workflows, or user workflows.
- The build script remains POSIX-shell based, matching the existing `mkdir`/`cp` build style.

## Reusable Agent Guidance

No reusable guidance change is needed. This was a local package build regression.
