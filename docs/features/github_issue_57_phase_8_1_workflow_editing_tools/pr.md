Fixes #57

## Summary

- Added validated workflow edit primitives for project-installed workflows.
- Added CLI commands for add/remove/reorder phase and set-template workflow edits.
- Added backups and reports for successful workflow edits.
- Added active task current-phase compatibility protection.
- Added focused integration coverage for workflow editing and made the CLI PTY test helper portable on macOS.

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
- `docs/features/github_issue_57_phase_8_1_workflow_editing_tools/pr.md`

## Tests Run

- `pnpm build`
- `pnpm test -- --run tests/integration/workflow-editor.test.ts`
- `rm -rf dist && pnpm build && pnpm test -- --run tests/integration/runtime-bin.test.ts`
- `pnpm test`

## PlaySpec Task ID

`github_issue_57_phase_8_1_workflow_editing_tools`

## Risk Notes

- Workflow edit commands intentionally reject built-in and user-home workflow sources; users must install/export into `.playspec/workflows` before editing.
- `remove-phase --replacement` is report metadata only and does not mutate active task records.
- No MCP workflow editing tools or evolution proposal workflow mutation were added in this phase.
