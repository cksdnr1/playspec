# Install Preset Workflows During Init Result

## Behavior Implemented

- `playspec init --preset default` now installs bundled workflow directories into `WorkflowRegistry.getUserRoot()`.
- Init creates the user workflow root when needed.
- Init copies only missing workflow ids and leaves already-installed workflow directories untouched.
- Existing `.playspec` state initialization, config/session copying, HEAD creation, built-in workflow fallback, and workflow execution behavior remain unchanged.

## Files Changed

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/runtime-bin.test.ts`
- `docs/features/install_preset_workflows_during_init/spec.md`
- `docs/features/install_preset_workflows_during_init/spec_validation.md`
- `docs/features/install_preset_workflows_during_init/plan.md`
- `docs/features/install_preset_workflows_during_init/result.md`

## Verification

- `pnpm install` passed.
- `pnpm test -- tests/integration/init-create-next.test.ts` passed.
- `pnpm test -- tests/integration/runtime-bin.test.ts` passed.
- `pnpm build` passed.
- `pnpm test` passed: 18 test files, 286 tests.

## Remaining Risks

- Existing installed workflow ids are intentionally not refreshed by rerunning init, to avoid overwriting user modifications.
- Future preset-specific workflow manifests are still deferred because the current default preset does not declare a workflow subset.
- No reusable agent guidance needs to be documented; this is a narrow init behavior fix.

## Refactor Review

- Scope guard passed.
- No safe local refactor was applied; the current changes are already limited to preset initialization, focused init/runtime tests, and PlaySpec task documentation.

## Final PR Prep

- Branch: `agent/issue-40-install-presets`
- PR: pending creation
