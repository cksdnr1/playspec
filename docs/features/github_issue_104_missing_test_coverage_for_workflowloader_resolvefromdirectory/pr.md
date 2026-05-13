Fixes #104

## Summary

- Added direct integration coverage for `WorkflowLoader.resolveFromDirectory()` with a valid explicit workflow directory.
- Added missing `workflow.yaml` rejection coverage for explicit directory loading.
- Added direct coverage for `WorkflowRegistry.getBuiltinRoot()` resolving to the preset workflow assets root.

## Changed Files

- `tests/integration/workflow-loader.test.ts`
- `docs/features/github_issue_104_missing_test_coverage_for_workflowloader_resolvefromdirectory/spec.md`
- `docs/features/github_issue_104_missing_test_coverage_for_workflowloader_resolvefromdirectory/plan.md`
- `docs/features/github_issue_104_missing_test_coverage_for_workflowloader_resolvefromdirectory/result.md`
- `docs/features/github_issue_104_missing_test_coverage_for_workflowloader_resolvefromdirectory/pr.md`

## Tests Run

- `pnpm install`
- `pnpm vitest run tests/integration/workflow-loader.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `github_issue_104_missing_test_coverage_for_workflowloader_resolvefromdirectory`

## Risk Notes

- Test-only change; runtime workflow loading behavior is unchanged.
- The builtin root assertion accepts both `src` and `dist` layouts because Vitest aliases modules to TypeScript source while the compiled CLI resolves from `dist`.

## Reusable Agent Guidance

- No reusable agent guidance update is needed. Existing repository instructions already cover workflow usage, validation, and path alias constraints.
