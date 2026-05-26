# Warn Workflow Shadow Artifact Drift Result

## Files Changed

- `src/core/types.ts`
- `src/workflow/workflow-loader.ts`
- `src/cli/commands/workflow.ts`
- `tests/integration/workflow-loader.test.ts`
- `tests/cli.test.ts`
- `docs/features/warn_workflow_shadow_artifact_drift/spec.md`
- `docs/features/warn_workflow_shadow_artifact_drift/plan.md`
- `docs/features/warn_workflow_shadow_artifact_drift/result.md`

## Behavior Implemented

- Added `ResolvedWorkflow.diagnostics` with `workflow_builtin_shadow_artifact_drift` warnings.
- Preserved project/user workflow precedence when installed workflows shadow built-ins.
- Limited stale-shadow diagnostics to `version`, workflow `artifacts`, and phase `outputs`.
- Added `WorkflowLoader.listWithDiagnostics()` for listing effective workflows with the same diagnostic metadata as `resolve()`.
- Updated hidden workflow CLI list/show output to print clear warning details with active and built-in roots.
- Removed built-in fallback behavior from workflow resolution.

## Verification Performed

- `pnpm test -- tests/integration/workflow-loader.test.ts` passed: 43 tests.
- `pnpm build` passed.
- `pnpm test` passed: 29 files, 585 tests.

## Remaining Risks

- Diagnostics intentionally do not compare template content, variables, or prompt instructions unless they affect artifact/output/version fields. This matches issue scope but will not warn on prompt-only stale copies.
- Existing `builtinShadow.accepted` remains metadata only for compatibility; it no longer suppresses diagnostics or changes source selection.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- Applied no extra refactor because the implementation is already local to workflow loader/types/CLI diagnostics/tests and further cleanup would add churn without reducing risk.
- Re-ran `pnpm test` after updating the old CLI fallback assertion; full suite passed.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/230
- Branch: `agent/issue-228-workflow-shadow-warnings`
- Reusable agent guidance: no new guidance needed; this is a narrow workflow-loader diagnostic behavior change.
