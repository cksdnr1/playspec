# Summary

- Adds a product-level MCP integration test that drives a complete PlaySpec lifecycle through MCP handlers only.
- Covers MCP task creation, session binding, prompt rendering, context addition, gated routing, terminal completion, artifact/status lookup, duplicate rejection, and evolution proposal handling.
- Scopes MCP evolution proposal tools to explicit `workspaceRoot` values so project-local MCP workflows behave consistently.
- Updates result-related error hints to name the MCP action clients should call next.

# Why this PR

Issue #285 identified that PlaySpec had many individual MCP tool tests but no single end-to-end MCP-only product contract. That left gaps such as task creation, workspace-root consistency, terminal completion behavior, duplicate handling, and evolution handling to surface during real user work instead of integration validation.

# Problem

Before this change, the MCP suite did not prove that an MCP client could create a task and complete a multi-phase PlaySpec workflow without CLI fallback or direct task-store setup. Some completion errors also pointed only at CLI flags, and several evolution proposal tools used server-root stores instead of an explicit project workspace.

# How it was fixed

- `tests/integration/mcp-server.test.ts`
  - Adds a minimal project-local `mcp-lifecycle-flow` fixture.
  - Creates the lifecycle task via `playspec_create_task`, binds `mcp.lifecycle`, and continues through MCP tool handlers.
  - Completes a normal phase, asserts gated missing-result guidance, routes `approved` to a final phase, and asserts terminal metadata/finalized artifacts.
  - Generates, fetches, and lists an evolution proposal through MCP.
  - Asserts duplicate MCP task creation is rejected and no duplicate completed task appears.
  - Uses an explicit project workspace while the server workspace differs.

- `src/mcp/server.ts`
  - Adds scoped evolution context creation for proposal store/apply runner operations.
  - Adds optional `workspaceRoot` support to proposal list/get/store/update/append/skip/diff/apply tools.

- `src/core/errors.ts`
  - Updates duplicate and gated-result hints to include the relevant MCP tool names.

# Validation

- `pnpm vitest run tests/integration/mcp-server.test.ts` passed: 70 tests.
- `pnpm build` passed.
- `pnpm test` passed: 32 test files, 671 tests.

# Changed files

- `tests/integration/mcp-server.test.ts`
- `src/mcp/server.ts`
- `src/core/errors.ts`
- `docs/features/add_end_to_end_mcp_only_playspec_lifecycle_test/*`
- `docs/issues/285/source.md`

# Tests run

- `pnpm vitest run tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

# PlaySpec task id

`add_end_to_end_mcp_only_playspec_lifecycle_test`

# Risks / follow-ups

- Full idempotent rerun/dedupe support remains future work; this PR asserts the current safe duplicate behavior.
- No reusable agent guidance changes were needed. This is a repository test/support fix, not a workflow prompt policy change.

# Risk notes

- No destructive operations, migrations, archive changes, or CLI workflow progression changes are included.
- MCP context resolution remains on `resolveMcpTaskId()`.

Fixes #285
