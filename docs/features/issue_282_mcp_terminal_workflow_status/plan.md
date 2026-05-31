# Issue 282 MCP Terminal Workflow Status Plan

## Implementation Steps

1. Extend completion result types.
   - Edit `src/core/types.ts`.
   - Add `FinalizedWorkflowArtifact`, `CompletionOperatorGuidance`, and `TerminalWorkflowStatus`-style fields directly to `CompletionResult`.
   - Keep existing `completedPhase`, `nextPhase`, and `status` fields unchanged for backward compatibility.

2. Resolve final workflow artifact metadata in core.
   - Edit `src/core/playspec-core.ts`.
   - After `taskStore.completePhase()` and optional evolution context snapshot, compute additive response fields from the already-loaded workflow, completed phase, completion event, updated task, and existing `VariableResolver`.
   - Resolve `workflow.definition.artifacts` paths using the task variables and workflow defaults.
   - Return each artifact with role, path, kind, description, and an `exists` boolean.

3. Add terminal response guidance without changing routing.
   - Set `isWorkflowComplete` from `updatedTask.status === 'completed' && updatedTask.currentPhase === null`.
   - Set `completedPhaseId`, `previousPhaseId`, `nextPhaseId`, `taskStatus`, `workflow`, and `completionRecordPath`.
   - Add `operatorGuidance` with valid next MCP calls. Terminal guidance should point callers to `playspec_get_task`, `playspec_list_tasks`, and artifact inspection through returned paths. Non-final guidance should continue to point at `playspec_render_next_prompt` / `playspec_complete_phase`.

4. Add MCP integration coverage.
   - Edit `tests/integration/mcp-server.test.ts`.
   - Add a project-local two-phase workflow with workflow artifacts.
   - Complete the first phase through the registered MCP handler and assert `isWorkflowComplete: false`, `nextPhaseId` / `nextPhase`, and non-terminal guidance.
   - Complete the final phase through the same MCP handler and assert `isWorkflowComplete: true`, `taskStatus: completed`, `nextPhaseId: null`, finalized artifact metadata, completion record path, and terminal guidance.
   - Verify `playspec_get_task` and `playspec_list_tasks` observe the completed task consistently after final completion.

5. Validate.
   - Run focused MCP integration tests first.
   - Run the full test suite and build if focused tests pass.

## Files To Edit

- `src/core/types.ts`
- `src/core/playspec-core.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_282_mcp_terminal_workflow_status/result.md`
- `docs/features/issue_282_mcp_terminal_workflow_status/pr.md`

## Tests

Focused command:

```bash
pnpm vitest run tests/integration/mcp-server.test.ts
```

Repository validation:

```bash
pnpm test
pnpm build
```

## Risks

- Artifact paths are declarations, not proof that files exist. Include `exists` to make this explicit.
- Adding aliases duplicates existing fields. This is intentional to harden the MCP response contract while keeping older callers compatible.
- Keep all MCP context resolution unchanged; do not read `.playspec/HEAD` in MCP.

## Rollback Notes

The change is additive. Reverting `src/core/types.ts`, `src/core/playspec-core.ts`, and the MCP test restores the previous response shape.

## Completion Criteria

- Final MCP complete-phase response includes terminal status, completion record path, and resolved artifact metadata.
- Non-final MCP completion still exposes the next phase.
- Completed task state is observable through MCP get/list task tools.
- Focused MCP tests, full tests, and build pass or any failure is reported with cause.
