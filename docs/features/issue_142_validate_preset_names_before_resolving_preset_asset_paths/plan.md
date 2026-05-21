# Validate Preset Names Implementation Plan

## Ordered Steps

1. Add preset-name validation in `src/preset/preset-manager.ts`.
   - Export `assertSafePresetName(presetName: string): void`.
   - Call it as the first statement in `PresetManager.initWorkspace()`, before computing `presetAssetsDir`.
   - Reject null bytes, POSIX absolute paths, Windows absolute paths, `/`, `\`, `.`, and `..`.
   - Keep valid direct-child preset names such as `default` accepted.

2. Add direct `PresetManager` integration coverage in `tests/integration/init-create-next.test.ts`.
   - Add table-driven unsafe-name cases for `../default`, `..\\default`, `/tmp/default`, `C:\\default`, `bad/name`, `bad\\name`, `\0`, `.`, and `..`.
   - Assert `initWorkspace()` rejects with a validation message.
   - Assert `.playspec` is not created for these failures, proving validation happens before workspace directory mutation.

3. Add CLI coverage in `tests/cli.test.ts`.
   - Run `playspec init --preset ../default` in a fresh temp workspace.
   - Assert exit code `1`.
   - Assert stderr includes the validation message.
   - Assert `.playspec` was not created.

4. Run focused validation, then full repository validation.
   - Focused: `pnpm test -- tests/integration/init-create-next.test.ts tests/cli.test.ts`.
   - Build: `pnpm build`.
   - Full: `pnpm test`.

## Files To Edit

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_142_validate_preset_names_before_resolving_preset_asset_paths/result.md`
- `docs/features/issue_142_validate_preset_names_before_resolving_preset_asset_paths/pr.md`

## Tests To Add Or Update

- Direct API regression: unsafe preset names reject before `.playspec` exists.
- CLI regression: invalid `--preset` reports the validation error and leaves the workspace uninitialized.
- Existing valid init tests continue to prove `default` still initializes config, sessions, HEAD, and workflows.

## Old Paths, Bypass Paths, And Partial Migration Risks

- Old path: `PresetManager.initWorkspace()` currently computes `path.join(__dirname, 'assets', presetName)` before validation.
- Bypass path: direct callers of `PresetManager.initWorkspace()` bypass CLI validation, so validation must live in the preset manager layer.
- Partial migration risk: adding validation only to CLI would leave programmatic callers unsafe. Adding validation after `mkdir(.playspec/tasks/active)` would still mutate workspace state for invalid input.

## Risks

- Future preset naming schemes could require wider allowed characters. Current risk is low because only `default` exists and bundled presets are direct asset children.
- Windows absolute-path detection must use `path.win32.isAbsolute()` in addition to `path.isAbsolute()` so tests are portable on macOS/Linux.

## Rollback Notes

The code change is isolated to preset-name validation and tests. Rollback is a normal git revert of the changed files; no migration or generated runtime state rollback is required.

## Completion Criteria

- `PresetManager.initWorkspace()` validates preset names before resolving preset asset paths.
- Unsafe direct API calls reject before `.playspec` creation.
- Unsafe CLI init exits with a clear error before `.playspec` creation.
- `playspec init --preset default` behavior remains unchanged.
- Focused tests, build, and full tests pass or any failure is documented with a concrete blocker.
