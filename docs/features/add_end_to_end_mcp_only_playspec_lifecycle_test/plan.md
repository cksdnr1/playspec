# Implementation Plan: End-to-end MCP-only PlaySpec lifecycle test

## Steps

1. Add a focused fixture builder in `tests/integration/mcp-server.test.ts`.
   - Initialize a temp workspace with `PresetManager.initWorkspace()`.
   - Write `.playspec/workflows/mcp-lifecycle-flow/workflow.yaml`.
   - Write templates for `problem`, `gate`, and `final`.
   - Write source/context/evidence/artifact fixture files under the temp workspace.

2. Add one end-to-end MCP-only lifecycle test.
   - Use `getRegisteredToolHandler()` for every user workflow action.
   - Create the lifecycle task with `playspec_create_task`.
   - Bind a session during creation and continue through `sessionId`.
   - Render the first prompt with `playspec_render_next_prompt`.
   - Add context with `playspec_add_context`.
   - Complete the normal phase with `playspec_complete_phase`.
   - Render the gated phase.
   - Assert missing gated result returns an MCP error with guidance.
   - Complete the gated phase with `result: approved` and assert route to `final`.
   - Render and complete the final phase.
   - Assert terminal status, finalized artifact metadata, completion record, task lookup, completed listing, and operator guidance.

3. Add duplicate/evolution assertions inside the lifecycle test.
   - Attempt to create the same task id again via MCP and assert an error plus unchanged task count.
   - Generate an evolution proposal through `playspec_generate_evolution_proposal`.
   - Fetch it through `playspec_get_evolution_proposal`.
   - If workspace scoping is missing for proposal lookup, fix the MCP evolution handlers narrowly.

4. Add a no-CLI assertion.
   - Spy on the imported `execa` function during the lifecycle block.
   - Use no CLI helper for task creation or phase progression.
   - Restore the spy before other tests can use `execa`.

5. Apply small API fixes only if test failures expose them.
   - Prefer improving `PlaySpecError` hints for MCP-valid next actions over adding MCP-specific branching.
   - Keep MCP task resolution on `resolveMcpTaskId()`.
   - Keep workspace-root scoping local to MCP handlers and avoid Core dependency on CLI/HEAD.

## Files to Edit

- `tests/integration/mcp-server.test.ts`
  - Add the lifecycle test and fixture helper.

- `src/core/errors.ts`
  - Possible narrow hint updates for gated completion errors.

- `src/mcp/server.ts`
  - Possible narrow workspace-root scoping fixes for evolution proposal read/list/update/append tools.

- `docs/features/add_end_to_end_mcp_only_playspec_lifecycle_test/result.md`
  - Final implementation and validation notes.

## Tests

- Run targeted MCP integration test:
  - `pnpm vitest run tests/integration/mcp-server.test.ts`

- Run full validation if targeted test passes:
  - `pnpm build`
  - `pnpm test`

## Risks

- The lifecycle test can become brittle if it depends on bundled `mono-spec`; keep the workflow fixture local and minimal.
- Evolution lookup scoping may need a support fix because some handlers currently close over server-root stores.
- True idempotent rerun support may not exist; assert duplicate prevention and record a follow-up rather than implementing broad dedupe.
- Feedback extraction warning from the mono-spec validation prompt is unrelated to this issue and should not be fixed here.

## Rollback Notes

- Revert the test and any narrow MCP/error hint changes.
- No migration or destructive data operations are introduced.

## Completion Criteria

- The lifecycle task is created only through MCP in the test.
- Multiple phases render and complete through MCP.
- Gated routing and terminal completion are asserted.
- Project-local workspace behavior is asserted.
- Duplicate and evolution behavior are covered or explicitly recorded as follow-up.
- Targeted and full repository validation pass.
