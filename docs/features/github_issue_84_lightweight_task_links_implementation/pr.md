# PR: GitHub Issue 84 Lightweight Task Links Implementation

Fixes #84

## Summary

- Adds optional outgoing task links with `parent`, `after`, and `related` metadata.
- Adds exact-then-unique-prefix task ID resolution for task-link flows.
- Adds create-time `--parent` and `--after`, plus `playspec link` and `playspec unlink`.
- Updates `playspec status [taskId]` with direct outgoing/incoming links and direct parent suggested-next.
- Adds compact linked-task context to rendered prompts for linked tasks.
- Documents the new CLI commands and adds focused integration coverage.

## Changed Files

- `README.md`
- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/errors.ts`
- `src/core/task-id-resolver.ts`
- `src/core/playspec-core.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/index.ts`
- `src/cli/commands/create.ts`
- `src/cli/commands/link.ts`
- `src/cli/commands/unlink.ts`
- `src/cli/commands/status.ts`
- `tests/integration/task-links.test.ts`
- `docs/features/github_issue_84_lightweight_task_links_implementation/spec.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/spec_validation.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/plan.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/plan_validation.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/result.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/pr.md`

## Tests Run

- `pnpm install`
- `pnpm build`
- `pnpm test tests/integration/task-links.test.ts`
- `pnpm test`
- `pnpm exec tsc --noEmit`
- Manual CLI smoke test in `/volume2/PJ/playspec-issue-84-smoke`

## PlaySpec Task

- `github_issue_84_lightweight_task_links_implementation`

## Risk Notes

- Suggested-next is intentionally direct-only and should not be treated as a scheduler.
- Archived task link display/resolution remains out of v1 scope.
- No MCP, migration, evolution, viewer, archive, or inverse-link persistence behavior was added.

## Reusable Agent Guidance

No reusable agent guidance needs to be added. Existing repository rules already cover phase scope, Core/CLI separation, and MCP boundaries.
