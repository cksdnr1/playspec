# Implementation Plan

## Ordered Steps

1. Update `src/preset/preset-manager.ts`.
   - Keep `mkdir(path.join(playspecRoot, 'tasks', 'active'), { recursive: true })`.
   - Replace direct recursive session copy with non-destructive session installation.
   - Copy `.playspec/config.yaml` only when it does not already exist.
   - Create `.playspec/HEAD` as an empty file only when it does not already exist.
   - Leave `installPresetWorkflows()` behavior unchanged.

2. Add a small helper inside `PresetManager`.
   - Use `access()` to detect existing destination files.
   - For missing files, copy or write defaults.
   - Keep the helper private and local to the preset manager; no new cross-module API is needed.

3. Update `tests/integration/init-create-next.test.ts`.
   - Keep the existing first-init structure test and ensure it asserts:
     - `.playspec/config.yaml`
     - `.playspec/HEAD`
     - `.playspec/sessions/cli.default.yaml`
     - `.playspec/tasks/active`
     - selected workflow destination
   - Add a rerun regression test that:
     - runs `initWorkspace()` once
     - writes custom `.playspec/config.yaml`
     - writes a non-empty `.playspec/HEAD`
     - writes custom `.playspec/sessions/cli.default.yaml`
     - writes an existing custom workflow file
     - reruns `initWorkspace()`
     - verifies all custom values are preserved

4. Validate.
   - Run focused integration test:
     - `pnpm vitest run tests/integration/init-create-next.test.ts`
   - Run full repository validation:
     - `pnpm build`
     - `pnpm test`

## Files to Edit

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`

## Active Entry Point Trace

`playspec init` -> `src/cli/commands/init.ts` -> `PresetManager.initWorkspace()` -> `.playspec` filesystem state.

User-visible behavior:
- First init still creates the expected workspace files and directories.
- Rerun init preserves existing config, HEAD, session files, and complete workflow directories.

## Old Paths, Bypasses, and Partial Migration Risks

Old destructive paths to close:
- `cp(...config.yaml...)` overwriting existing config.
- `writeTextFile(HEAD, '')` clearing existing HEAD.
- Recursive session copy refreshing existing preset session files.

Bypass paths:
- `playspec create` and `playspec use` intentionally write HEAD and should not change.
- Workflow install skip-if-present remains in `installPresetWorkflows()`.

Partial migration risk:
- A missing session directory should still be created on first init.
- A missing default session file should still be installed even if the session directory already exists.
- A partial workflow directory without `workflow.yaml` should still be repaired by existing workflow logic.

## Tests to Add or Update

- Update the existing first-init structure test only if needed to keep all required creation assertions explicit.
- Add a regression test named to document the non-destructive rerun contract, including config, HEAD, session file, and workflow file preservation.

## Risks

- Preserving existing config changes behavior for automation that used `init` as an implicit config refresh. This is accepted because the method-level contract says init is safe to rerun.
- Recursive directory copy behavior differs by platform when destinations exist; avoiding overwrite through explicit file-level checks makes the behavior clearer and testable.

## Rollback Notes

- Revert the guarded copy/write changes in `src/preset/preset-manager.ts`.
- Remove the rerun regression test.
- Existing workflow installation code remains untouched, so rollback scope is limited.

## Completion Criteria

- Rerunning `PresetManager.initWorkspace()` preserves existing `.playspec/config.yaml`.
- Rerunning `PresetManager.initWorkspace()` preserves existing `.playspec/HEAD`.
- Rerunning `PresetManager.initWorkspace()` preserves existing preset session files.
- Existing workflow skip-if-present behavior still passes.
- First-time init still creates required default state.
- Focused and full validation commands pass.
