# Issue 78 MCP Update Result

## Implemented

- Updated `src/mcp/server.ts` with current MCP tools for task lifecycle, snapshots, rollback planning/execution, harness state, evolution proposal lifecycle/generation/apply, and human edit observations.
- Preserved explicit MCP task/session resolution through `resolveMcpTaskId()` for all task-scoped tools.
- Added explicit mutation gates:
  - `playspec_execute_git_rollback` requires `confirm: true`.
  - `playspec_apply_evolution_proposal` requires `approved: true`.
- Reused existing Core/evolution services instead of CLI command modules.
- Kept archive and migration out of MCP scope.
- Updated MCP integration tests and README registered tool list.

## Verification So Far

- `pnpm build` passed.
- `pnpm vitest run tests/integration/mcp-server.test.ts` passed: 21 tests.
- `pnpm test` passed: 22 files, 379 tests.
- Post-implementation spec verification passed.
- Refactor guard found one issue where validation report loading suppressed non-missing errors; patched to rethrow non-`ENOENT` and zod errors.
- Build validator passed `pnpm build` and focused MCP tests.

## Risks

- MCP apply and git rollback are intentionally exposed but guarded by explicit booleans. Reviewers should verify these tools remain separate from preview/list tools.
- Evolution generation response reports `invokedBy: "mcp"` while persisted proposal metadata remains the existing generator value.

## Safe Refactor

- Reviewed diff against `origin/master`.
- Applied only one local cleanup: combined duplicate zod imports in `src/mcp/server.ts`.
- Skipped broader helper extraction because the MCP tool registrations are explicit and changing that shape would add review risk without reducing current behavior risk.

## PR Preparation

- PR notes written to `docs/features/issue_78_mcp_update/pr.md`.
- Reusable agent guidance decision: no update needed; existing MCP guidance is sufficient.
- PR link: pending branch push and draft PR creation.
