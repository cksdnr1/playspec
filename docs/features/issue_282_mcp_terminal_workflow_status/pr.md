Fixes #282

## Summary

- Adds explicit terminal workflow status fields to `PlaySpecCore.completePhase()` results, including `isWorkflowComplete`, `taskStatus`, `nextPhaseId`, and `completionRecordPath`.
- Returns resolved workflow artifact metadata with an `exists` flag so MCP callers can inspect final declared artifacts without a CLI follow-up.
- Adds MCP integration coverage for both non-final and final phase completion, including completed task visibility through get/list task tools.

## Why This PR

MCP-only PlaySpec automation can complete phases but previously had to infer terminal workflow completion from `nextPhase === null` and then make follow-up calls to discover final artifacts. Issue #282 asks for a structured terminal contract from `playspec_complete_phase` itself.

## Problem

Final-phase MCP completion returned the same raw completion shape as intermediate phases. It did not explicitly identify workflow completion, did not include resolved workflow artifact declarations, and did not guide MCP callers toward valid next actions after the task reached `completed`.

## How It Was Fixed

- `src/core/types.ts` extends `CompletionResult` with additive terminal contract fields and artifact/guidance types.
- `src/core/playspec-core.ts` enriches the existing core completion result after the existing task state transition, reusing the loaded workflow and existing variable resolution rather than duplicating completion logic in MCP.
- `tests/integration/mcp-server.test.ts` creates a two-phase workflow, completes both phases through the registered MCP handler, and asserts non-final next phase behavior plus final terminal status, artifact metadata, completion record path, and completed task visibility.

## Validation

- `pnpm vitest run tests/integration/mcp-server.test.ts -t "terminal workflow status" --reporter=verbose` passed.
- `pnpm vitest run tests/integration/mcp-server.test.ts` passed.
- `pnpm test` passed: 665 tests.
- `pnpm build` passed.

## Risks / Follow-ups

- The response now includes additive aliases alongside existing fields for compatibility.
- Artifact `exists` reflects current filesystem presence; a declared artifact may be valid even when not yet materialized.
