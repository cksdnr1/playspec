# Draft PR: Install Preset Workflows During Init

Fixes #40

## Summary

- Installs bundled workflow directories into `WorkflowRegistry.getUserRoot()` during `playspec init --preset default`.
- Preserves existing installed workflow directories by skipping workflow ids that already exist.
- Adds regression coverage for source init, idempotent non-overwrite behavior, and compiled CLI init.

## Changed Files

- `src/preset/preset-manager.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/runtime-bin.test.ts`
- `docs/features/install_preset_workflows_during_init/spec.md`
- `docs/features/install_preset_workflows_during_init/spec_validation.md`
- `docs/features/install_preset_workflows_during_init/plan.md`
- `docs/features/install_preset_workflows_during_init/result.md`
- `docs/features/install_preset_workflows_during_init/pr.md`

## Tests Run

- `pnpm install`
- `pnpm test -- tests/integration/init-create-next.test.ts`
- `pnpm test -- tests/integration/runtime-bin.test.ts`
- `pnpm build`
- `pnpm test -- tests/cli.test.ts`
- `pnpm test`

## PlaySpec Task

- Task id: `install_preset_workflows_during_init`
- Workflow: `mono-spec`

## Risk Notes

- Init intentionally skips existing installed workflow directories to avoid overwriting user-modified workflows.
- Future preset-specific workflow manifests remain out of scope because the current `default` preset does not declare a workflow subset.
- No reusable agent guidance needs to be documented; this is a narrow init behavior fix.
