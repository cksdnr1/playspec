# Draft PR Notes

Fixes #122

## Summary

- Changed preset workflow install skip logic to require destination `workflow.yaml` before treating a workflow as already installed.
- Added integration coverage for repairing partial project workflow directories.
- Added integration coverage for repairing partial user workflow directories.
- Preserved existing non-overwrite behavior for complete workflows with custom `workflow.yaml`.

## Changed Files

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/fix_preset_workflow_partial_install/spec.md`
- `docs/features/fix_preset_workflow_partial_install/plan.md`
- `docs/features/fix_preset_workflow_partial_install/result.md`
- `docs/features/fix_preset_workflow_partial_install/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/init-create-next.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

- `fix_preset_workflow_partial_install`

## Risk Notes

- The repair path copies builtin workflow assets into a destination directory that exists without `workflow.yaml`. This can add files beside existing partial content, but complete workflows remain protected because any destination with `workflow.yaml` is skipped.

## Reusable Agent Guidance

- No new reusable agent guidance is needed. The issue is a local contract mismatch between preset install and workflow registry validity checks.
