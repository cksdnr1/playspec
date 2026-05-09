# GitHub Issue 57 Phase 8.1 Workflow Editing Tools Result

## Summary

Implemented validated workflow editing tools for project-installed workflows:

- `playspec workflow add-phase`
- `playspec workflow remove-phase`
- `playspec workflow reorder-phase`
- `playspec workflow set-template`

The commands mutate only `.playspec/workflows/{workflowId}/workflow.yaml`, reject built-in/user-source workflow edits, validate template paths, protect active task current phases, create workflow backups, and write edit reports.

## Changed Files

- `src/workflow/workflow-editor.ts`
- `src/workflow/workflow-loader.ts`
- `src/workflow/index.ts`
- `src/cli/commands/workflow.ts`
- `src/cli/index.ts`
- `tests/integration/workflow-editor.test.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_57_phase_8_1_workflow_editing_tools/spec.md`
- `docs/features/github_issue_57_phase_8_1_workflow_editing_tools/plan.md`
- `docs/features/github_issue_57_phase_8_1_workflow_editing_tools/result.md`

## Tests Run

- `pnpm build` passed.
- `pnpm test -- --run tests/integration/workflow-editor.test.ts` passed.
- `rm -rf dist && pnpm build && pnpm test -- --run tests/integration/runtime-bin.test.ts` passed.
- `pnpm test` passed: 24 files, 402 tests.

## Notes

The first full `pnpm test` run failed because stale generated `dist/` output contained an obsolete alias reference and because the CLI PTY test helper used Linux `script(1)` flags on macOS. The validation retry cleaned `dist/`, rebuilt, added a portable macOS branch to the PTY helper, and passed the full suite.
