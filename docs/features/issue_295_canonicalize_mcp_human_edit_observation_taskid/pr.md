# Draft PR

PR: https://github.com/cksdnr1/playspec/pull/296

Fixes #295

## Summary

- Resolve `playspec_record_human_edit_observation` MCP `taskId` inputs through scoped MCP task resolution before persisting `sourceTaskId`.
- Preserve unscoped/proposal-only human edit observation writes when no `taskId` is provided.
- Add MCP integration coverage for unique prefix canonicalization, ambiguous/missing prefix rejection without writes, and evolution-context inclusion for prefix-recorded observations.

## Changed Files

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_295_canonicalize_mcp_human_edit_observation_taskid/spec.md`
- `docs/features/issue_295_canonicalize_mcp_human_edit_observation_taskid/plan.md`
- `docs/features/issue_295_canonicalize_mcp_human_edit_observation_taskid/result.md`
- `docs/features/issue_295_canonicalize_mcp_human_edit_observation_taskid/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_295_canonicalize_mcp_human_edit_observation_taskid`

## Risk Notes

- MCP callers that previously stored arbitrary `taskId` strings on human edit observations now receive resolver errors for unknown or ambiguous task references.
- CLI human edit recording is unchanged.

## Reusable Agent Guidance

- No new reusable guidance is needed. The existing AGENTS.md rule that MCP context resolution must use `resolveMcpTaskId()` already covers the general lesson.
