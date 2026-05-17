# Fix Preset Workflow Partial Install Plan

## Ordered Implementation Steps

1. Update `src/preset/preset-manager.ts`.
   - In `installPresetWorkflows`, keep the existing builtin source validation.
   - Change the destination skip check from `access(targetDir)` to `access(path.join(targetDir, "workflow.yaml"))`.
   - If destination `workflow.yaml` is missing, call `cp(sourceDir, targetDir, { recursive: true })` as today so partial directories are filled with missing builtin assets.

2. Add project-scope integration coverage in `tests/integration/init-create-next.test.ts`.
   - Before `PresetManager.initWorkspace(workspace.dir, "default")`, create `.playspec/workflows/mono-spec/` with no `workflow.yaml`.
   - Assert init installs `.playspec/workflows/mono-spec/workflow.yaml`.
   - Assert init installs `.playspec/workflows/mono-spec/templates/tech_spec_draft.md`.

3. Add user-scope integration coverage in `tests/integration/init-create-next.test.ts`.
   - Use the existing `PLAY_SPEC_USER_WORKFLOWS` test setup.
   - Before `PresetManager.initWorkspace(workspace.dir, "default", { workflowInstall: "user" })`, create `user-workflows/mono-spec/` with no `workflow.yaml`.
   - Assert init installs `user-workflows/mono-spec/workflow.yaml`.
   - Assert init installs `user-workflows/mono-spec/templates/tech_spec_draft.md`.
   - Keep the project workflow root absent assertion for user-scope installs.

4. Preserve existing non-overwrite behavior.
   - Leave the current custom `workflow.yaml` test in place.
   - Confirm it still passes after the installer check change.

## Files To Edit

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/fix_preset_workflow_partial_install/result.md` after implementation
- `docs/features/fix_preset_workflow_partial_install/pr.md` during PR preparation

## Tests To Run

1. Targeted integration test file:
   - `pnpm vitest run tests/integration/init-create-next.test.ts`
2. Full validation:
   - `pnpm build`
   - `pnpm test`

## Entry Point To User-Visible Behavior Trace

- CLI/user call: `playspec init --preset default --workflow-install project|user`
- Core action: `runInit` calls `PresetManager.initWorkspace`
- State/data update: `installPresetWorkflows` copies builtin workflow assets into the chosen root when destination `workflow.yaml` is absent
- Propagation: `WorkflowRegistry.resolve` and `WorkflowLoader` can later find the installed workflow through the destination `workflow.yaml`
- Reset/clear: no reset/clear path is involved; rerun init is idempotent for complete installs and repair-oriented for partial installs
- User-visible behavior: rerun init leaves a resolvable workflow and expected templates at the requested project or user destination

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: `access(targetDir)` skipped any existing directory. The implementation must remove that weaker skip condition.
- Bypass path: `workflowInstall: "skip"` remains unchanged.
- Complete workflow path: existing destination `workflow.yaml` must still bypass copying to avoid overwriting customized workflows.
- Partial migration risk: copying into a partial directory can add builtin files beside unrelated local files. This is constrained to invalid workflow installs without `workflow.yaml` and matches the registry contract.

## Completion Criteria

- Empty project workflow directory is repaired by init.
- Empty user workflow directory is repaired by init.
- Existing complete workflow directories are not overwritten.
- Registry and loader code remain unchanged.
- Targeted integration tests, build, and full test suite pass.

## Rollback Notes

Rollback is a simple revert of the installer skip-check change and the two added integration tests. No persistent data migration is introduced.
