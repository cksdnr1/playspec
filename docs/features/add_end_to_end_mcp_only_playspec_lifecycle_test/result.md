# Result: End-to-end MCP-only PlaySpec lifecycle test

## Implemented

- Added an end-to-end MCP lifecycle integration test in `tests/integration/mcp-server.test.ts`.
- The test creates a task through `playspec_create_task`, binds a session, renders prompts, adds context, completes a normal phase, validates gated phase error guidance, routes a gated phase with `approved`, completes the final phase, and asserts terminal task status/artifacts.
- The test uses an explicit project workspace while the MCP server is rooted elsewhere.
- Duplicate task rerun behavior is covered by asserting the second MCP create call is rejected and no duplicate completed task appears.
- Evolution handling is covered by generating, fetching, and listing a proposal through MCP against the explicit project workspace.
- CLI fallback is guarded by constraining `PATH` to a fake `git` executable during lifecycle progression; the workflow still completes through direct MCP handlers.

## Supporting Fixes

- Updated gated completion error hints to name `playspec_complete_phase` as the MCP action for missing/invalid/unexpected results.
- Scoped MCP evolution proposal list/get/store/update/append/skip/diff/apply handlers to an explicit `workspaceRoot` when supplied.
- Updated duplicate task error guidance to mention `playspec_list_tasks`.

## Validation

- `pnpm vitest run tests/integration/mcp-server.test.ts` passed: 70 tests.
- `pnpm build` passed.
- `pnpm test` passed: 32 test files, 671 tests.

## Remaining Risks

- True idempotent rerun/dedupe semantics are still outside this issue; this test records the current safe behavior by proving duplicate MCP creation is rejected without creating a second task.
- The PlaySpec validation prompt emitted a feedback extraction warning during local workflow gating because the rendered prompt includes placeholder enum examples. That is unrelated to the MCP lifecycle implementation and was not changed here.

## Refactor Review

- Reviewed the branch diff against `origin/master`.
- Skipped further refactoring because the changes are already localized to the MCP server, core error hints, and the MCP integration suite.
- No behavior-preserving cleanup was worth the risk of obscuring the lifecycle test contract.

## PR Preparation

- PR body source written to `docs/features/add_end_to_end_mcp_only_playspec_lifecycle_test/pr.md`.
- Reusable agent guidance: not needed; the change is a focused test/API support fix.
- Branch: `agent/issue-285-mcp-lifecycle`.
- PR link: pending creation.
