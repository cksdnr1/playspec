# Issue 282 MCP Terminal Workflow Status Result

## Behavior Implemented

- `PlaySpecCore.completePhase()` now returns an additive terminal workflow contract for all completions.
- Final completion responses include explicit `isWorkflowComplete`, `taskStatus`, `nextPhaseId`, `completionRecordPath`, `operatorGuidance`, and resolved `finalizedArtifacts` metadata.
- Workflow artifact declarations are resolved through existing task/workflow variables and include an `exists` flag so MCP callers can distinguish declared final artifacts from files already present.
- Non-final completion keeps the existing next-phase behavior and adds guidance to continue rendering/completing the workflow.

## Files Changed

- `src/core/types.ts`
- `src/core/playspec-core.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_282_mcp_terminal_workflow_status/spec.md`
- `docs/features/issue_282_mcp_terminal_workflow_status/plan.md`
- `docs/features/issue_282_mcp_terminal_workflow_status/result.md`

## Verification

- `pnpm vitest run tests/integration/mcp-server.test.ts -t "terminal workflow status" --reporter=verbose` passed.
- `pnpm vitest run tests/integration/mcp-server.test.ts` passed: 64 tests.
- `pnpm test` passed: 665 tests.
- `pnpm build` passed.

## Remaining Risks

- The response keeps legacy field names and adds explicit aliases, so callers may see duplicate status fields. This is intentional for backward compatibility.
- `finalizedArtifacts.exists` reports current filesystem presence only; missing files remain valid declared artifacts for callers to inspect or produce.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional refactor was applied; the implementation is already localized to core completion response shaping and MCP integration coverage.
- Skipped broader helper extraction because the inline artifact template helpers are local to the new response contract and do not change workflow routing or rendering behavior.

## PR Preparation

- PR body source written to `docs/features/issue_282_mcp_terminal_workflow_status/pr.md`.
- Reusable agent guidance: no new reusable guidance is needed; this is a narrow response contract hardening change.
- PR link: https://github.com/cksdnr1/playspec/pull/287
