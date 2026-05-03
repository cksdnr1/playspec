# PlaySpec Update 6.5 Implementation Plan

## Ordered Steps

1. Add evolution context data contracts.
   - Edit `src/evolution/types.ts` with prompt summary and snapshot interfaces.
   - Edit `src/evolution/schemas.ts` with `EvolutionContextSnapshotSchema`.
   - Edit `src/utils/paths.ts` with context snapshot root/path helpers.

2. Add a read-only context reader.
   - Add `src/evolution/context-reader.ts`.
   - Use `EvolutionProposalStore.listProposals()` and `EvolutionHumanEditStore.listObservations()` only when explicit opt-in is set.
   - Filter pending/refining proposals by active task or explicit archived refs.
   - Filter recorded human edits by active task or included proposal IDs.
   - Format compact prompt summaries using only Phase 6.5 allowed proposal fields.
   - Write validated completion snapshots only through an explicit writer method.

3. Thread core options.
   - Edit `src/core/types.ts` for `PromptRenderOptions`, `CompletePhaseOptions`, and optional completion snapshot path result.
   - Edit `src/core/playspec-core.ts`.
   - `renderNextPrompt(taskId, { withEvolutionContext })` appends summary only when requested.
   - `completePhase(taskId, { withEvolutionContext })` writes snapshot after task completion persistence and before caller renders the next prompt.
   - Keep `renderExplicitPhasePrompt()` unchanged unless needed internally; Phase 6.5 does not expose `phase --with-evolution-context`.

4. Add CLI flags and propagation.
   - Edit `src/cli/index.ts`.
   - Edit `src/cli/commands/prompt.ts`, `src/cli/commands/next.ts`, and `src/cli/commands/complete.ts`.
   - Add `--with-evolution-context` for `prompt`, `next`, and `complete`.
   - Post-completion next prompt rendering should use the same opt-in option.

5. Add MCP arguments.
   - Edit `src/mcp/server.ts`.
   - Add optional `withEvolutionContext` to `playspec_render_next_prompt` and `playspec_complete_phase`.
   - Continue resolving task IDs only through `resolveMcpTaskId()`.

6. Add focused tests.
   - `tests/integration/init-create-next.test.ts`: core render opt-in/default-off, malformed record default-off, completion snapshot write/no-write.
   - `tests/cli.test.ts`: CLI flags surface summaries and snapshot path behavior where practical.
   - `tests/integration/mcp-server.test.ts`: MCP opt-in works with explicit task/session and no HEAD fallback.
   - Existing store tests remain unchanged unless a schema export requires direct validation coverage.

## Files To Edit

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/context-reader.ts`
- `src/utils/paths.ts`
- `src/core/types.ts`
- `src/core/playspec-core.ts`
- `src/cli/index.ts`
- `src/cli/commands/prompt.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/complete.ts`
- `src/mcp/server.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts`

## Old Paths And Bypasses

- `playspec phase` remains unchanged and default-off.
- Normal `prompt`, `next`, `complete`, and MCP calls without opt-in must not touch evolution stores.
- MCP tools must keep explicit task/session context and must not read HEAD.
- Prompt snapshot filenames are not part of this phase.

## Risks

- Malformed proposal/human edit records should throw only when opt-in reads them.
- Completion snapshot write must not alter task records or evolution proposal/human edit records.
- Appended prompt summary must stay compact and must not embed proposal actions or human edit details beyond IDs/counts.

## Rollback Notes

The feature is additive and default-off. If needed, rollback is removing the new CLI/MCP options, context reader, schema/types, path helpers, and tests. No migration is required because existing prompt markdown and task records remain compatible.

## Completion Criteria

- `--with-evolution-context` works on `prompt`, `next`, and `complete`.
- Core and MCP support explicit opt-in.
- Default-off paths do not load malformed evolution records.
- Completion writes validated snapshots only when requested.
- `pnpm build` and `pnpm test` pass.
