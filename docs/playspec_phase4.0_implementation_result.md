# PlaySpec Dev Phase 4.0 Implementation Result — MCP Adapter

## Phase Summary

Dev Phase 4.0 adds an MCP stdio adapter so Claude Code, Codex, and OpenClaw can call PlaySpec Core with explicit task context. The central safety rule is strict: MCP must receive `taskId` or `sessionId`; MCP must not fall back to `.playspec/HEAD`.

## Intended Scope vs Actual Scope

Intended scope: 10 MCP tools, no HEAD fallback, session write path, zod input validation.

Actual scope: matches exactly. No additional tools, no future-phase work introduced.

## Changed Files

### New files

- `src/mcp/errors.ts` — `McpTaskContextRequiredError`, `McpSessionContextEmptyError`
- `src/mcp/session-store.ts` — `McpSessionStore` (load/save/setSessionTask)
- `src/mcp/context.ts` — `resolveMcpTaskId()` (no HEAD fallback)
- `src/mcp/server.ts` — `buildMcpServer()` with all 10 Phase 4.0 tools registered
- `src/mcp/index.ts` — stdio entry point
- `tests/integration/mcp-server.test.ts` — 14 tests covering context resolver, session store, and server instantiation

### Modified files

- `package.json` — `@modelcontextprotocol/sdk: 1.29.0` added to dependencies (via pnpm); `playspec-mcp: dist/mcp/index.js` added to bin
- `tsconfig.json` — `#mcp/*.js` path alias added
- `vitest.config.ts` — `#mcp` alias added for test resolution

## Changed Classes/Functions

- `McpTaskContextRequiredError` (new) — thrown when no taskId or sessionId is supplied
- `McpSessionContextEmptyError` (new) — thrown when session YAML has `currentTaskId: null`
- `McpSessionStore` (new) — YAML read/write for `.playspec/sessions/{sessionId}.yaml`; no HEAD involvement
- `resolveMcpTaskId()` (new) — prefers explicit `taskId`, falls back to session, never touches HEAD
- `buildMcpServer()` (new) — constructs `McpServer`, creates `YamlTaskStore`/`PlaySpecCore`/`McpSessionStore`, registers all 10 Phase 4.0 tools

## Implementation Plan Step Coverage

All 10 tools listed in spec Section 10 are registered:
- `playspec_list_tasks` ✓
- `playspec_get_task` ✓
- `playspec_use_session_task` ✓ (creates session YAML, validates task exists first)
- `playspec_get_session_task` ✓
- `playspec_render_next_prompt` ✓ (calls `core.renderNextPrompt(resolvedTaskId)`)
- `playspec_render_phase_prompt` ✓ (calls `core.renderExplicitPhasePrompt`)
- `playspec_complete_phase` ✓ (calls `core.completePhase` with optional `withReview`/`result`)
- `playspec_collect_evidence` ✓ (calls `core.collectEvidence`)
- `playspec_run_state_desync_check` ✓ (calls `core.checkTaskDesync`)
- `playspec_rollback_state` ✓ (calls `core.rollbackStateOnly`; state-only, no git rollback)

## Spec Coverage Before vs After

Before: 0/10 tools implemented. No MCP entry point, no session write path.

After: 10/10 tools implemented. Entry point starts cleanly. Context resolver tested. Session store tested. No HEAD fallback confirmed.

## Build/Compile Validation

- Command: `npx tsc --noEmit`
- Result: success (zero errors)
- Command: `corepack pnpm run build` (tsc + tsc-alias + asset copy)
- Result: success; `dist/mcp/` emits `index.js`, `server.js`, `context.js`, `session-store.js`, `errors.js`
- Blocking: no

## End-to-End Validation

- MCP stdio entry starts and exits cleanly on stdin close: ✓
- `resolveMcpTaskId({})` throws `McpTaskContextRequiredError` (not `NoActiveTaskError`): ✓
- HEAD set to task B, calling `resolveMcpTaskId({ taskId: taskA })` returns taskA: ✓
- `McpSessionStore.setSessionTask` writes YAML, `loadSession` reads it back: ✓
- `resolveMcpTaskId({ sessionId })` resolves to session's `currentTaskId`: ✓
- `resolveMcpTaskId` with `taskId` takes precedence over `sessionId`: ✓
- `resolveMcpTaskId({ sessionId: 'empty' })` with null `currentTaskId` throws `McpSessionContextEmptyError`: ✓
- `buildMcpServer()` instantiates without error: ✓
- Full test suite: 115/115 (101 pre-existing + 14 new) — 0 regressions

## Old/Bypass Path Status

- CLI commands still use `ActiveTaskResolver` with HEAD fallback for human CLI. **This is expected and correct.** MCP never imports CLI commands.
- No MCP code calls `ActiveTaskResolver.resolveTask()` — verified by code review.
- `resolveMcpTaskId` is a standalone function with no HEAD dependency.

## Unresolved Blockers or Ambiguities

None.

## Intentionally Deferred Items

- `playspec_migrate` and historical doc migration: Phase 4.1
- Archive/close tools: Phase 5
- Evolution proposal/apply tools: Phase 6
- Harness attempt/retry tools: Phase 7
- Markdown viewer: Phase 9
- SQLite storage: future phase
- Confirmed git rollback via MCP: explicitly deferred per spec (state-only only in Phase 4.0)
- Rollback preview (`planRollback`) via MCP: deferred; spec says "optionally" and state-only is the safe default

## Deviations from Spec

None. All 10 tools from Section 10 are implemented. Context resolution follows the exact flow in Section 14 (Mermaid diagram). Session write ownership follows spec Section 5 and Section 13 ("Smallest safe fix: add minimal session store").

## Next Phase Readiness

Phase 4.1 dependency: "working MCP stdio server, reliable tool registration, explicit context resolution, and stable structured tool results."

All four requirements are satisfied. Phase 4.1 can begin.
