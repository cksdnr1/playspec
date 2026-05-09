# Issue 94 MCP Link And Missing Tools Result

## Implemented

- Added MCP tools for task link and unlink operations with explicit source context.
- Added MCP workflow tools for list, show, validate, install, remove, export, add phase, remove phase, reorder phase, and set template.
- Brought in the validated project workflow editor used by CLI and MCP workflow edit tools.
- Added integration coverage for MCP tool registration, no-HEAD task link behavior, and MCP workflow edits.

## Files Changed

- `src/mcp/server.ts`
- `src/workflow/workflow-editor.ts`
- `src/workflow/workflow-loader.ts`
- `src/workflow/index.ts`
- `src/cli/commands/workflow.ts`
- `src/cli/index.ts`
- `tests/integration/mcp-server.test.ts`
- `tests/integration/workflow-editor.test.ts`
- `tests/cli.test.ts`

## Verification

- `pnpm install`
- `pnpm build`
- `pnpm test`

Full test result: 24 test files passed, 404 tests passed.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/96
- Issue label `agent-pr-created` added.
- Reusable agent guidance: no AGENTS.md update needed; the existing MCP context rules already covered the important no-HEAD boundary.

## Refactor Review

- Reviewed the branch diff after verification.
- No additional refactor was applied; the implementation already stays within MCP, workflow editor wiring, and focused tests.
- Removed unrelated issue-57 documentation introduced by the workflow-editor cherry-pick before commit staging.

## Remaining Risks

- Workflow removal is exposed through MCP but requires `confirm: true`.
- Evolution tools were already present in MCP, so this change preserves them rather than replacing their contracts.
