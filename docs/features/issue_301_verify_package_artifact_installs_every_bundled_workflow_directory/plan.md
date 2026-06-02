# Issue #301 Implementation Plan

## Ordered Steps

1. Update `tests/integration/package-artifact.test.ts` imports if needed to support source workflow directory scanning.
2. Add a helper near the existing filesystem helpers:
   - Read `src/preset/assets/workflows` with `readdir(..., { withFileTypes: true })`.
   - Keep only directory entries.
   - Keep only directories where `workflow.yaml` exists.
   - Return sorted workflow IDs for deterministic assertions.
3. In the package artifact test, compute `expectedBundledWorkflowIds` before installed package assertions.
4. Keep the existing `expectedInstalledFiles` assertions for compiled runtime files and the `mono-spec` template.
5. Add a loop that checks `dist/preset/assets/workflows/<workflow-id>/workflow.yaml` under the installed package root for each discovered workflow ID.
6. Keep existing unexpected stale installed file assertions unchanged.
7. After installed `playspec init --preset default`, replace the single `mono-spec` project workflow assertion with a loop over all expected workflow IDs checking `.playspec/workflows/<workflow-id>/workflow.yaml`.
8. Run `pnpm test:package-artifact`.

## Files To Edit

- `tests/integration/package-artifact.test.ts`

## Tests To Add Or Update

- Update the existing package artifact integration test only.
- Required validation: `pnpm test:package-artifact`.
- The workflow-loader focused integration test is not required because workflow loading expectations and product code are not changing.

## Active Entry Point Trace

- Test entry: `pnpm test:package-artifact`
- Pack path: `pnpm pack` invokes `prepack`, which runs the existing build asset copy.
- Install path: consumer workspace installs the tarball.
- Installed package assertion: verifies every source workflow directory with `workflow.yaml` has a matching installed `dist/preset/assets/workflows/<workflow-id>/workflow.yaml`.
- Init path: installed `playspec init --preset default` runs `PresetManager.installPresetWorkflows()`.
- User-visible result: every expected bundled workflow is available in consumer `.playspec/workflows/<workflow-id>/workflow.yaml`.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: single hardcoded `mono-spec` workflow assertion. Replace the post-init assertion and supplement installed package assertions with the full discovered set.
- Bypass path: source-only workflow loading is not exercised; this is acceptable because the regression target is the packed artifact and installed init behavior.
- Partial migration risk: adding non-workflow files under `src/preset/assets/workflows` must not fail the test. Filtering by `workflow.yaml` closes this risk.

## Risks

- If source workflow directories are renamed or removed, the test expectation changes with the source tree. That is intended for artifact parity.
- If package packing fails for a workflow, the new loop should provide the missing workflow path in the assertion failure.

## Rollback Notes

- Revert the package artifact test helper and loops to restore previous mono-spec-only coverage.
- No product state, migration, generated package metadata, or workflow assets are changed.

## Completion Criteria

- The package artifact test derives expected workflow IDs from `src/preset/assets/workflows` directories containing `workflow.yaml`.
- Installed package assertions cover every expected workflow YAML.
- Post-init consumer workspace assertions cover every expected workflow YAML.
- Existing stale asset cleanup and compiled runtime assertions remain intact.
- `pnpm test:package-artifact` passes.
