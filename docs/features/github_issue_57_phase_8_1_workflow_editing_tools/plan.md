# GitHub Issue 57 Phase 8.1 Workflow Editing Tools Plan

## Implementation Steps

1. Add workflow edit domain types and report helpers in `src/workflow/`.
   - Define supported edit commands.
   - Define active task compatibility and edit report shapes.
   - Add path helpers for workflow edit backups and reports.

2. Implement a `WorkflowEditor` service in `src/workflow/`.
   - Resolve only project-installed workflows.
   - Validate template paths before mutation.
   - Apply `add-phase`, `remove-phase`, `reorder-phase`, and `set-template` edits to parsed workflow objects.
   - Validate active task compatibility against `YamlTaskStore.listActiveTasks()`.
   - Back up, write atomically, reload, and report successful edits.

3. Wire CLI commands in `src/cli/commands/workflow.ts` and `src/cli/index.ts`.
   - Keep CLI code thin.
   - Print concise success output including report and backup paths.

4. Add focused workflow editor tests.
   - Use temp workspaces initialized with the default preset.
   - Install or create project workflow assets under `.playspec/workflows`.
   - Verify success paths create backup/report files.
   - Verify rejection paths do not create backup/report files.
   - Verify active task current phase protection.
   - Verify built-in preset workflows are rejected as read-only.

5. Run validation.
   - `pnpm build`
   - `pnpm test -- --run tests/integration/workflow-editor.test.ts`
   - `pnpm test`

## Risk Controls

- Do not mutate built-in workflows.
- Do not mutate task records.
- Reject unsafe edits before backup/write where the phase plan requires it.
- Use existing schema validation and loader validation after edits.
- Keep MCP unchanged.
