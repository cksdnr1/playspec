# Draft PR Notes

Fixes #65

Draft PR: https://github.com/cksdnr1/playspec/pull/71

## Summary

- Add explicit CLI-only evolution proposal generation for Phase 7.1.
- Validate generated proposals before storage and reuse existing proposal save/update paths.
- Block generation when the task harness is blocked or circuit breaker is active.
- Reject duplicate active target-file overlap unless refining with `--proposal`.
- Keep MCP generation tools out of scope.

## Changed Files

- `src/evolution/types.ts`
- `src/evolution/schemas.ts`
- `src/evolution/proposal-generator.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `tests/integration/evolution-proposal-generator.test.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/routing.test.ts`
- `docs/features/playspec_update_7_1/spec.md`
- `docs/features/playspec_update_7_1/plan.md`
- `docs/features/playspec_update_7_1/result.md`
- `docs/features/playspec_update_7_1/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/evolution-proposal-generator.test.ts tests/integration/mcp-server.test.ts`
- `pnpm vitest run tests/cli.test.ts -t "proposes, lists, shows, and skips an evolution proposal from YAML|generates and refines evolution proposals from explicit CLI evidence" --reporter verbose`
- `pnpm vitest run tests/cli.test.ts`
- `pnpm vitest run tests/integration/mcp-server.test.ts tests/integration/init-create-next.test.ts`
- `pnpm build && pnpm test`

## PlaySpec Task

- Task ID: `playspec_update_7_1`

## Risk Notes

- Generated proposals are deterministic drafts from explicit evidence and CLI fields.
- Duplicate detection by target-file overlap is conservative.
- Test helper changes use local `tsx` instead of `npx tsx` to avoid unrelated subprocess timeout behavior.
