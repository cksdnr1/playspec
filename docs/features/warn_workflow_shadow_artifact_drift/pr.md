# PR: Warn When Installed Workflows Shadow Built-In Artifact Definitions

Fixes #228

## Summary

- Preserve project/user workflow precedence when installed workflows shadow built-ins.
- Add `ResolvedWorkflow.diagnostics` and `WorkflowLoader.listWithDiagnostics()` for artifact/output/version drift warnings.
- Print diagnostic warnings in hidden `playspec workflow list/show` output.
- Add regression coverage for project and user shadows, matching artifact definitions, `issue-scope-create` stale artifact/output definitions, and CLI warning output.

## Changed Files

- `src/core/types.ts`
- `src/workflow/workflow-loader.ts`
- `src/cli/commands/workflow.ts`
- `tests/integration/workflow-loader.test.ts`
- `tests/cli.test.ts`
- `docs/features/warn_workflow_shadow_artifact_drift/spec.md`
- `docs/features/warn_workflow_shadow_artifact_drift/plan.md`
- `docs/features/warn_workflow_shadow_artifact_drift/result.md`
- `docs/features/warn_workflow_shadow_artifact_drift/pr.md`

## Tests Run

- `pnpm test -- tests/integration/workflow-loader.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `warn_workflow_shadow_artifact_drift`

## Risk Notes

- Diagnostics intentionally compare only workflow `version`, workflow `artifacts`, and phase `outputs`; prompt-only stale copies do not warn.
- `builtinShadow.accepted` remains compatibility metadata and no longer changes source selection or suppresses diagnostics.
