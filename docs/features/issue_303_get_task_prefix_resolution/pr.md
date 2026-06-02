# PR Notes

Fixes #303

## Summary

- Route `playspec_get_task` task ID lookup through the scoped `TaskIdResolver` before fetching the task record.
- Add MCP integration coverage for unique-prefix lookup and ambiguous-prefix guidance.
- Update the existing missing lookup diagnostic assertion to the resolver-backed missing-task message while preserving workspace diagnostics checks.

## Changed Files

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_303_get_task_prefix_resolution/spec.md`
- `docs/features/issue_303_get_task_prefix_resolution/plan.md`
- `docs/features/issue_303_get_task_prefix_resolution/result.md`
- `docs/features/issue_303_get_task_prefix_resolution/pr.md`

## Tests Run

```text
pnpm test -- tests/integration/mcp-server.test.ts
pnpm build
```

## PlaySpec Task

`issue_303_get_task_prefix_resolution`

## Risk Notes

- The resolver is built from the same effective-workspace `YamlTaskStore` used for fetch, preserving workspaceRoot scoping and diagnostics.
- No CLI task lookup behavior changed.
- No `.playspec/HEAD` fallback or session semantics were added to `playspec_get_task`.
- README MCP guidance was already accurate; no README edit was needed.

## Reusable Agent Guidance

No reusable agent guidance change is needed. The repository instructions already state that MCP context resolution must use `resolveMcpTaskId()` and avoid `.playspec/HEAD`; this issue is a narrow read-only lookup routing fix.
