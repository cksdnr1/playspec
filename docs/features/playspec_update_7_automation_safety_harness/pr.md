# PR Notes: PlaySpec Update 7 Automation Safety Harness

Draft PR: https://github.com/cksdnr1/playspec/pull/70

## Summary

- Adds a task-scoped automation safety harness record at `.playspec/tasks/active/{taskId}/harness.yaml`.
- Adds validated core status, attempt, and reset behavior for retry budgets, blocked state, circuit breakers, and reset events.
- Adds `playspec harness status`, `playspec harness attempt`, and `playspec harness reset` CLI commands.
- Adds focused integration and CLI coverage for harness state and preserves MCP no-HEAD fallback coverage.

## Changed Files

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/errors.ts`
- `src/core/playspec-core.ts`
- `src/utils/paths.ts`
- `src/cli/index.ts`
- `src/cli/commands/harness.ts`
- `tests/cli.test.ts`
- `tests/integration/harness-store.test.ts`
- `docs/features/playspec_update_7_automation_safety_harness/spec.md`
- `docs/features/playspec_update_7_automation_safety_harness/plan.md`
- `docs/features/playspec_update_7_automation_safety_harness/result.md`
- `docs/features/playspec_update_7_automation_safety_harness/pr.md`

## Tests Run

- `pnpm build`
- `pnpm test -- --run tests/integration/harness-store.test.ts tests/integration/mcp-server.test.ts`
- `pnpm test -- --run tests/cli.test.ts -t 'harness|help output'`
- `pnpm test -- --run tests/cli.test.ts -t 'lists relevant existing files for HEAD with specs --path-only' --testTimeout 30000`

## Full Suite Note

- `pnpm test` was attempted and hit unrelated subprocess-heavy CLI/MCP timeout failures.
- `pnpm test -- --testTimeout 30000` was attempted and cleared those earlier timeout points, then later hung in the large CLI suite. The observed isolated hang-adjacent CLI test passed by itself.
- `pnpm vitest run tests/cli.test.ts --reporter verbose --testTimeout 30000` confirmed the new harness CLI test passes in the broader CLI file after reducing subprocess count, then later failed on an existing evolution apply timeout.

## Risk Notes

- Retry budget is fixed at `3` in this phase.
- Optional MCP harness status tooling was intentionally omitted.
- No Phase 7.1 automatic proposal generation, autonomous runner, prompt/completion changes, or broad mutation paths were added.
