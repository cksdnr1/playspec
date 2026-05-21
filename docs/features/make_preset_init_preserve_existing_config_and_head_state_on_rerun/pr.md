# PR Draft

Fixes #137

## Summary

- Make `PresetManager.initWorkspace()` preserve existing preset-owned workspace state on rerun.
- Install missing default session/config/HEAD files without overwriting existing local values.
- Add regression coverage for rerunning init with custom config, HEAD, session, and workflow files.

## Changed Files

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/make_preset_init_preserve_existing_config_and_head_state_on_rerun/spec.md`
- `docs/features/make_preset_init_preserve_existing_config_and_head_state_on_rerun/plan.md`
- `docs/features/make_preset_init_preserve_existing_config_and_head_state_on_rerun/result.md`
- `docs/features/make_preset_init_preserve_existing_config_and_head_state_on_rerun/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/init-create-next.test.ts`
- `pnpm build`
- `pnpm vitest run tests/cli.test.ts -t "creates evidence and snapshot artifacts via the CLI without phase mutation"`
- `pnpm vitest run tests/cli.test.ts`
- `pnpm test`

## PlaySpec Task ID

`make_preset_init_preserve_existing_config_and_head_state_on_rerun`

## Risk Notes

- Preserving existing `.playspec/config.yaml` changes behavior for automation that used `playspec init` as an implicit config refresh. This matches the documented safe-to-rerun contract.
- Existing session files are now preserved on rerun, consistent with preserving user-owned `.playspec` state.
