# Issue 94 MCP Link And Missing Tools Plan

1. Bring the validated workflow editor into mainline if not present.
2. Register MCP task link and unlink tools in `src/mcp/server.ts`.
3. Register MCP workflow management and edit tools in `src/mcp/server.ts`.
4. Reuse `TaskIdResolver`, `resolveMcpTaskId`, `WorkflowLoader`, `WorkflowInstaller`, and `WorkflowEditor`.
5. Add integration tests for tool registration, link/unlink behavior, no HEAD fallback, and workflow editing.
6. Run `pnpm install`, `pnpm build`, and `pnpm test`.
7. Commit, push, open a draft PR with `Fixes #94`, label the issue, and report status on the issue.

## Risks

- MCP must not reintroduce HEAD fallback. Tests cover this by setting HEAD to a different task and omitting source context.
- Workflow mutations must not bypass validation. MCP calls the same `WorkflowEditor` as CLI.
- Removal is potentially destructive. MCP requires `confirm: true`.
