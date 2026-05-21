# PR: Validate Preset Names Before Resolving Preset Asset Paths

Fixes #142

## Summary

- Add `assertSafePresetName()` and call it before `PresetManager` resolves bundled preset asset paths.
- Reject null bytes, absolute paths, path separators, `.`, and `..` for preset names.
- Add direct `PresetManager` and CLI regression coverage that invalid preset names fail before `.playspec` state is created.

## Changed Files

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_142_validate_preset_names_before_resolving_preset_asset_paths/spec.md`
- `docs/features/issue_142_validate_preset_names_before_resolving_preset_asset_paths/plan.md`
- `docs/features/issue_142_validate_preset_names_before_resolving_preset_asset_paths/result.md`
- `docs/features/issue_142_validate_preset_names_before_resolving_preset_asset_paths/pr.md`

## Tests Run

- `pnpm test -- tests/integration/init-create-next.test.ts tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_142_validate_preset_names_before_resolving_preset_asset_paths`

## Risk Notes

- Low risk. The validation is intentionally conservative because current bundled presets are direct children and only `default` exists today.
- No reusable agent guidance is needed; this is a narrow preset initialization guard.
