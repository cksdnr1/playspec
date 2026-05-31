Fixes #283

## Summary

- Documents the supported MCP-only evolution lifecycle from workflow completion through final proposal status reporting.
- Updates README MCP tool coverage to include thread-evidence append and link the lifecycle guide.
- Adds MCP integration tests for completion with evolution context, proposal generation/refinement, evidence append/fetch, duplicate handling, diff, and approval-gated apply.

## Why This PR

MCP already exposed granular evolution tools, but agents did not have a documented and tested end-to-end contract for what to do after a workflow completes. That made it unclear how to move from final feedback/evidence to a proposal that is skipped, pending/refining, or applied without accidentally over-automating evolution.

## Problem

Before this change, README listed most MCP evolution tools but did not describe the supported sequence. Existing tests covered registration and isolated tool behavior, but not the complete MCP-only lifecycle. Duplicate target handling and explicit refinement were covered elsewhere, but not as an MCP path from generated evidence.

## How It Was Fixed

- Added `docs/mcp-evolution-lifecycle.md` with the supported sequence:
  completion with optional evolution context, explicit evidence, proposal generation, duplicate/refinement handling, evidence/thread evidence append, list/get, diff, approval-gated apply, and final status reporting.
- Updated `README.md` to include `playspec_append_evolution_thread_evidence` and link the lifecycle doc from the MCP section.
- Extended `tests/integration/mcp-server.test.ts` with MCP tool-handler coverage for:
  completion-to-proposal flow with `withEvolutionContext`;
  evidence append/list/get status reporting;
  duplicate active target refusal and explicit `proposalId` refinement;
  feedback-thread evidence append and fetch;
  executable proposal diff, apply rejection without approval, approved apply, and `applied` status.

## Changed Files

- `README.md`
- `docs/mcp-evolution-lifecycle.md`
- `tests/integration/mcp-server.test.ts`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/spec.md`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/plan.md`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/result.md`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/pr.md`

## Validation

- `pnpm exec vitest run tests/integration/mcp-server.test.ts` passed.
- `pnpm build` passed.
- `pnpm test` passed: 32 test files, 672 tests.
- No validation commands were skipped.

## PlaySpec Task

- `define_and_test_mcp_only_evolution_lifecycle`

## Risks / Follow-Ups

- No source behavior was changed; this PR documents and tests the current granular MCP contract.
- Apply remains explicitly gated by `approved: true`; the lifecycle doc states that workflow completion never auto-applies evolution proposals.
- Non-task-scoped evolution MCP tools continue to use the server workspace root, which is unchanged and outside this issue scope.
- Reusable agent guidance was documented in `docs/mcp-evolution-lifecycle.md`; no AGENTS.md update is needed because this is product MCP lifecycle guidance rather than repository contributor policy.
