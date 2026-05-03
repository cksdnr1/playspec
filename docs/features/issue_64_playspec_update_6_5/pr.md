# PR Draft: PlaySpec Update 6.5

Fixes #64

## Summary

- Add explicit opt-in evolution context surfacing for CLI `prompt`, `next`, and `complete`.
- Add read-only evolution context collection and compact prompt summaries for pending/refining proposals plus related human edit observations.
- Add validated completion-time context snapshots under `.playspec/evolution/context/{taskId}/{phaseId}-{timestamp}.yaml`.
- Add MCP opt-in arguments for prompt and complete while preserving `resolveMcpTaskId()` explicit context behavior.
- Add focused core, CLI, and MCP regression tests.

## Changed Files

- `src/evolution/context-reader.ts`
- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/utils/paths.ts`
- `src/core/types.ts`
- `src/core/playspec-core.ts`
- `src/cli/index.ts`
- `src/cli/commands/prompt.ts`
- `src/cli/commands/next.ts`
- `src/cli/commands/complete.ts`
- `src/mcp/server.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_64_playspec_update_6_5/*`

## Tests Run

- `pnpm build`
- `pnpm test -- --run tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
- `pnpm test -- --run tests/cli.test.ts`
- `pnpm test`

## PlaySpec Task

- `issue_64_playspec_update_6_5`

## Risk Notes

- Feature is default-off and read-only except for explicit completion context snapshot writes.
- This does not implement proposal generation, proposal apply, harness behavior, viewer behavior, or Phase 8 context modes.
- CLI suite is slow in this environment but passed.

## Reusable Agent Guidance

No reusable AGENTS.md guidance is needed. Existing project rules already cover MCP explicit context, phase boundaries, and no future-phase implementation.
