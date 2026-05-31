# Implementation Plan

## Ordered Steps

1. Add failing MCP integration coverage in `tests/integration/mcp-server.test.ts`.
   - Record a human edit observation with a unique task ID prefix.
   - Assert the returned observation and persisted YAML use the canonical task ID in `sourceTaskId`.
   - Record with an ambiguous prefix and with a nonexistent prefix.
   - Assert both calls return an MCP error and the human-edit observation directory is absent or empty.
   - Record a prefix-scoped observation, render the canonical task with `withEvolutionContext: true`, and assert the observation ID is considered.

2. Update `playspec_record_human_edit_observation` in `src/mcp/server.ts`.
   - Resolve the effective workspace with existing MCP workspace logic.
   - If `args.taskId` is provided, use the scoped `TaskIdResolver` to resolve it before observation construction.
   - Store only the canonical resolved task ID as `sourceTaskId`.
   - If resolution throws, return the existing `err(e)` response before saving.
   - If `args.taskId` is omitted, keep current proposal-only and unscoped observation behavior.
   - Save through an `EvolutionHumanEditStore` for the effective workspace root.

3. Run focused validation.
   - `pnpm vitest run tests/integration/mcp-server.test.ts`
   - If evolution-context coverage is added to a separate file, also run that focused file.
   - Run `pnpm build` after tests pass.

4. Update result and PR prep artifacts after validation.

## Files To Edit

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_295_canonicalize_mcp_human_edit_observation_taskid/result.md`
- `docs/features/issue_295_canonicalize_mcp_human_edit_observation_taskid/pr.md`

## Tests To Add Or Update

- MCP unique-prefix human edit write:
  - Arrange task `mcp_human_edit_observation_target`.
  - Call `playspec_record_human_edit_observation` with `taskId: "mcp_human_edit"`.
  - Assert persisted `sourceTaskId === "mcp_human_edit_observation_target"`.

- MCP ambiguous-prefix rejection:
  - Arrange tasks with the same prefix.
  - Call the handler with the shared prefix and an explicit ID.
  - Assert `isError === true`, guidance mentions ambiguity, and no observation file is written.

- MCP nonexistent-task rejection:
  - Call with a missing `taskId`.
  - Assert `isError === true` and no observation file is written.

- Evolution-context regression:
  - Record through MCP with a unique prefix.
  - Render the canonical task with `withEvolutionContext: true`.
  - Assert the prompt contains `## Evolution Context` and the human edit observation ID.

## Active Entry Point To User-Visible Chain

`playspec_record_human_edit_observation` -> `TaskIdResolver.resolve()` when `taskId` exists -> `EvolutionHumanEditStore.saveObservation()` with canonical `sourceTaskId` -> `PlaySpecCore.renderNextPrompt(..., { withEvolutionContext: true })` -> `EvolutionContextReader.collect()` exact-match includes the observation -> prompt lists the human edit observation ID.

## Old Paths And Bypass Risks

- The current bypass is direct `args.taskId` persistence. The handler change must remove that write path.
- CLI evolution recording remains unchanged by design.
- Proposal-only observations bypass task resolution by design when no `taskId` is provided.
- MCP must not read `.playspec/HEAD` for missing `taskId`; missing task context remains allowed for this tool only when no task scoping is requested.

## Risks

- Stricter rejection of arbitrary MCP `taskId` strings is intended by the issue and matches documented MCP behavior.
- Workspace-scoped calls must resolve and save in the same workspace. Construct the store after resolving the effective workspace root rather than reusing a server-root store for all calls.

## Rollback Notes

- Reverting `src/mcp/server.ts` restores raw `taskId` persistence.
- Tests are isolated to temporary workspaces and can be reverted independently.

## Completion Criteria

- Unique prefix is persisted as canonical `sourceTaskId`.
- Ambiguous and missing prefixes fail before observation write.
- No-`taskId` observations still write.
- Evolution-context rendering includes a prefix-recorded observation for the canonical task.
- Focused MCP integration test and build pass.
