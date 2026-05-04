# Issue 78 MCP Update Implementation Plan

## Ordered Steps

1. Update `src/mcp/server.ts` imports and helpers.
   - Add evolution store, apply runner, generator, human edit store, ID generator, schemas/types needed for zod contracts.
   - Add small local helpers only for MCP response path formatting, explicit boolean gate checks, and optional validation report loading.

2. Add task lifecycle MCP tools.
   - Register `playspec_add_context`, `playspec_set_current_phase`, `playspec_create_snapshot`, `playspec_plan_rollback`, and `playspec_execute_git_rollback`.
   - All task-scoped tools call `resolveMcpTaskId()`.
   - `playspec_execute_git_rollback` rejects unless `confirm === true`.

3. Add harness MCP tools.
   - Register `playspec_get_harness_status`, `playspec_record_harness_attempt`, and `playspec_reset_harness`.
   - Use zod enum `success | failure`.
   - Return `HarnessRecord` directly through the existing JSON envelope.

4. Add evolution MCP tools.
   - Register proposal generate/list/get/store/update/append-evidence/skip/diff/apply tools.
   - Store and update proposal objects only through `EvolutionProposalStore`.
   - Apply rejects unless `approved === true`, then calls `EvolutionApplyRunner.apply()` with approval source `mcp approved:true`.
   - Generation reuses `generateEvolutionProposal()` and returns `invokedBy: "mcp"` without schema changes.

5. Add human edit MCP tools.
   - Register `playspec_record_human_edit_observation` and `playspec_update_human_edit_observation_status`.
   - Build `HumanEditObservation` with current timestamps, `recorded` status, generated ID when omitted, and save/update through `EvolutionHumanEditStore`.

6. Update MCP integration tests in `tests/integration/mcp-server.test.ts`.
   - Replace stale no-evolution assertion with positive tool registration checks.
   - Keep no archive tool assertion.
   - Add registration/input-schema checks for confirm/approved/task-scoped tools.
   - Add direct Core/service behavior tests where server tool invocation is not ergonomic.

7. Update `README.md`.
   - Align the registered MCP tool list with `src/mcp/server.ts`.
   - Clarify explicit context still applies to all task-scoped MCP tools and that archive/migration remain CLI-only.

8. Record implementation evidence in `docs/features/issue_78_mcp_update/result.md`.

## Files To Edit

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `README.md`
- `docs/features/issue_78_mcp_update/result.md`
- `docs/features/issue_78_mcp_update/pr.md` later in PR phase

## Tests

Focused:

- `pnpm vitest run tests/integration/mcp-server.test.ts`

Full validation:

- `pnpm build`
- `pnpm test`

## Risks And Controls

- Git rollback and evolution apply are mutation-heavy. Both require explicit boolean approval gates at MCP boundary.
- Evolution proposal object intake must not persist unvalidated data. All persistence goes through `EvolutionProposalStore`.
- MCP must not use `.playspec/HEAD`. Every task-scoped new tool uses `resolveMcpTaskId()`.
- Archive and migration tools stay out of scope.

## Completion Criteria

- MCP server registers all tools listed in the spec and no archive/migration tools.
- Task-scoped tools require explicit `taskId` or `sessionId`.
- Confirm/approved gates reject false or omitted values.
- README tool list matches code.
- Focused MCP tests, build, and full test suite pass.
