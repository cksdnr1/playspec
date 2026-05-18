# Draft PR

Fixes #131

## Summary

- Route shared MCP `taskId` context inputs through `TaskIdResolver` so exact IDs and unique prefixes behave consistently.
- Canonicalize `playspec_use_session_task` bindings by resolving the provided task reference before writing the session.
- Add MCP integration coverage for unique prefixes, ambiguity errors, canonical session storage, and no-HEAD behavior.
- Document MCP unique-prefix support in the README.

## Changed Files

- `src/mcp/context.ts`
- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `README.md`
- `docs/features/resolve_mcp_taskid_context_inputs_consistently_with_taskidresolver/spec.md`
- `docs/features/resolve_mcp_taskid_context_inputs_consistently_with_taskidresolver/plan.md`
- `docs/features/resolve_mcp_taskid_context_inputs_consistently_with_taskidresolver/result.md`
- `docs/features/resolve_mcp_taskid_context_inputs_consistently_with_taskidresolver/pr.md`

## Tests Run

- `pnpm test -- tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`
- `pnpm test -- tests/integration/mcp-server.test.ts` after safe-refactor cleanup

## PlaySpec Task

- `resolve_mcp_taskid_context_inputs_consistently_with_taskidresolver`

## Risk Notes

- Session reads intentionally trust the stored canonical `currentTaskId`; `playspec_use_session_task` now enforces canonical storage.
- `playspec_get_task` remains exact lookup with diagnostics because it is not a shared task-context operation.

## Reusable Agent Guidance

No reusable agent guidance change is needed. The repository already documents that MCP code must use `resolveMcpTaskId()`, and this change strengthens that helper instead of adding a new workflow rule.
