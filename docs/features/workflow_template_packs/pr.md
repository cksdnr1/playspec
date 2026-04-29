# PR: Workflow Template Packs

Fixes #30

## Summary

- Added workflow/template pack manifests, validation, install/remove/list/show,
  and export commands.
- Added `playspec create <workflow> <title> --pack <packId>` and persisted
  `workflowPack` on task records.
- Made workflow/template rendering pack-aware while preserving old `.playspec`
  workflow/template behavior for existing tasks.
- Added declarative pack/workflow/phase variable defaults, including clear
  unknown-placeholder and cycle errors.
- Added total-plan artifact declarations for `TOTAL_SPEC_FILE` and
  `PHASE_PLAN_FILE` with legacy fallback for phase-execution linking.
- Added tests for custom pack variables/templates, archive export/install, old
  task compatibility, and variable default failure modes.

## Changed Files

- `src/pack/*`
- `src/cli/commands/pack.ts`
- `src/cli/commands/create.ts`
- `src/workflow/workflow-loader.ts`
- `src/template/*`
- `src/core/*`
- `src/storage/yaml-task-store.ts`
- `src/utils/paths.ts`
- `src/preset/assets/default/playspec-pack.yaml`
- `src/preset/assets/default/workflows/total-plan.yaml`
- `tests/unit/variable-resolver.test.ts`
- `tests/integration/pack.test.ts`
- `docs/features/workflow_template_packs/*`

## Tests Run

- `pnpm test`
- `pnpm build`
- `pnpm dev desync-check --task workflow_template_packs`
- `git diff --check`
- conflict marker search with `rg`

## PlaySpec Task

- `workflow_template_packs`

## Risk Notes

- Git URL pack install is intentionally not implemented.
- Installed pack immutability is version-directory based; no content-hash lock is
  added.
- Pack archive install/export uses local `tar`.
- Vitest timeout is raised to 30 seconds because full CLI integration runs can
  exceed the prior default while spawning many real CLI processes.

## Reusable Agent Guidance

No reusable agent guidance needs to be documented. The implementation follows
existing repository patterns and does not introduce a new recurring agent
workflow beyond the standard PlaySpec issue process.
