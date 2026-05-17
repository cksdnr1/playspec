# Fix Preset Workflow Partial Install Result

## Files Changed

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/fix_preset_workflow_partial_install/spec.md`
- `docs/features/fix_preset_workflow_partial_install/plan.md`
- `docs/features/fix_preset_workflow_partial_install/result.md`

## Behavior Implemented

- Preset workflow installation now treats a destination workflow as already installed only when `<workflow-id>/workflow.yaml` exists.
- Partial project workflow directories are repaired on rerun by copying builtin `workflow.yaml` and templates.
- Partial user workflow directories are repaired with the same behavior.
- Complete existing workflow directories still skip copying because their destination `workflow.yaml` exists.
- Registry and loader behavior were left unchanged.

## Verification Performed

- `pnpm vitest run tests/integration/init-create-next.test.ts` passed: 32 tests.
- `pnpm build` passed.
- `pnpm test` passed: 24 test files, 444 tests.

## Focused Tests Changed

- Added project-scope coverage for repairing `.playspec/workflows/mono-spec/` when the directory exists without `workflow.yaml`.
- Added user-scope coverage for repairing `PLAY_SPEC_USER_WORKFLOWS/mono-spec/` when the directory exists without `workflow.yaml`.
- Preserved the existing complete-workflow non-overwrite coverage.

## Focused Test Phase Result

- Reran `pnpm vitest run tests/integration/init-create-next.test.ts` after entering the focused test phase: 32 tests passed.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional refactor was applied; the implementation is already the smallest local change that aligns the installer with the registry contract.
- Intentionally skipped extracting helper functions because the check is used in one loop and a helper would add indirection without reducing duplication.
- Reran `pnpm vitest run tests/integration/init-create-next.test.ts` after the refactor review: 32 tests passed.

## Remaining Risks

- Copying into a partial workflow directory can add builtin files alongside preexisting local files. This is intentional for directories missing `workflow.yaml`, because the registry does not recognize them as installed workflows.

## PR Preparation

- Draft PR notes written to `docs/features/fix_preset_workflow_partial_install/pr.md`.
- Reusable agent guidance decision: no new guidance needed; this was a local preset installer contract fix.
- Draft PR created: https://github.com/cksdnr1/playspec/pull/124
- Branch pushed: `agent/issue-122-preset-partial-workflows`
