# Implementation Plan

## Ordered Steps

1. Update `src/mcp/context.ts`.
   - Import `TaskIdResolver` as a type from `#core/task-id-resolver.js`.
   - Change `resolveMcpTaskId()` to receive `taskIdResolver`.
   - Keep direct `taskId` safety validation first.
   - Resolve direct `taskId` through `taskIdResolver.resolve()` and return the canonical `taskId`.
   - Leave the `sessionId` branch as a session lookup that returns stored `currentTaskId`, preserving no-HEAD behavior.

2. Update `src/mcp/server.ts`.
   - In `playspec_use_session_task`, replace `taskStore.getTask(args.taskId)` with `taskIdResolver.resolve(args.taskId)`.
   - Store the resolved canonical task ID in `sessionStore.setSessionTask()`.
   - Pass `taskIdResolver` into every `resolveMcpTaskId()` call site.
   - Update `resolveMcpSourceTaskId()` so fallback `taskId`/`sessionId` source resolution also uses the resolver-aware context helper.

3. Update MCP integration tests in `tests/integration/mcp-server.test.ts`.
   - Add a local helper or inline construction for `new TaskIdResolver(store)` in direct `resolveMcpTaskId()` tests.
   - Update existing `resolveMcpTaskId()` calls for the new signature.
   - Add a `playspec_render_next_prompt` test proving a unique explicit `taskId` prefix returns the canonical task ID and renders successfully.
   - Add an ambiguous prefix test proving the MCP error includes the existing ambiguity message and hint from `TaskIdResolver`.
   - Add `playspec_use_session_task` tests proving a unique prefix stores the canonical ID and an ambiguous prefix is rejected.
   - Keep existing missing-context/no-HEAD tests unchanged in behavior.

4. Update `README.md`.
   - In the MCP section, document that MCP task-reference fields resolved through task context support exact IDs or unique prefixes.
   - State that ambiguous prefixes fail with ambiguity guidance.
   - State that `playspec_use_session_task` stores the canonical resolved task ID.

5. Run targeted and full validation.
   - `pnpm test -- tests/integration/mcp-server.test.ts`
   - `pnpm build`
   - `pnpm test`

## Files To Edit

- `src/mcp/context.ts`
- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `README.md`
- `docs/features/resolve_mcp_taskid_context_inputs_consistently_with_taskidresolver/result.md`
- `docs/features/resolve_mcp_taskid_context_inputs_consistently_with_taskidresolver/pr.md`

## Old Paths And Bypass Paths

- Old shared-context path: `resolveMcpTaskId()` returned direct `input.taskId` unchanged. This must be closed for all shared-context call sites.
- Existing link path: `sourceTaskId` and `targetTaskId` already use `TaskIdResolver`; keep that behavior.
- Fallback link source path: `resolveMcpSourceTaskId()` currently falls back to old shared-context behavior for `taskId`/`sessionId`; update it.
- Bypass left unchanged: `playspec_get_task` is direct lookup with diagnostics, not a shared task-context tool.
- Metadata-only bypass left unchanged: `playspec_record_human_edit_observation.taskId` is stored as observation metadata and does not invoke core task operations.

## E2E Verification Chain

- User passes unique prefix as `taskId` to `playspec_render_next_prompt`.
- MCP schema accepts the string.
- `resolveMcpTaskId()` validates MCP-safe characters.
- `TaskIdResolver.resolve()` maps prefix to canonical task ID or rejects ambiguity.
- `PlaySpecCore.renderNextPrompt()` receives canonical ID and reads the task.
- MCP response includes canonical `taskId` and prompt content.

Session chain:

- User calls `playspec_use_session_task` with unique prefix.
- Server resolves prefix to canonical ID.
- `McpSessionStore.setSessionTask()` persists canonical `currentTaskId`.
- Later `sessionId` call loads the session and routes to the canonical task.

## Risks

- Missed `resolveMcpTaskId()` call sites would preserve inconsistent routing. Mitigation: use `rg "resolveMcpTaskId"` after edits.
- Direct resolver unit tests now need a `TaskIdResolver`; avoid replacing them with server-only tests so missing-context/no-HEAD behavior remains explicit.
- Session reads intentionally do not re-resolve; canonical storage on bind is the invariant.

## Rollback Notes

The change is isolated to MCP context routing, README documentation, and tests. Reverting the code changes restores exact-only shared `taskId` behavior without storage migrations. No destructive file operations or session migrations are planned.

## Completion Criteria

- Shared MCP `taskId` accepts unique prefixes for prompt rendering.
- Ambiguous shared MCP `taskId` fails with `TaskIdResolver` ambiguity guidance.
- `playspec_use_session_task` stores canonical task IDs for unique prefixes and rejects ambiguous prefixes.
- Explicit `taskId` precedence over `sessionId` is preserved.
- Missing context still fails with `McpTaskContextRequiredError` and never reads `.playspec/HEAD`.
- README MCP guidance documents exact ID and unique-prefix support.
- Targeted and full validations pass.
