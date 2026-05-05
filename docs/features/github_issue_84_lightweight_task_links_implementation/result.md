# GitHub Issue 84 Lightweight Task Links Implementation Result

## Implemented

- Added optional `links` task metadata with strict `parent | after | related` validation.
- Added exact-then-unique-prefix task ID resolution for task-link CLI paths.
- Added create-time `--parent` and `--after` links.
- Added `playspec link` and `playspec unlink` with explicit source and current-task `--to` shorthand.
- Added duplicate-link and missing-unlink no-op warnings.
- Added self-link rejection.
- Updated `playspec status [taskId]` to show direct outgoing and incoming links plus direct parent suggested-next.
- Added compact linked-task context to rendered prompts for linked tasks only.
- Added focused integration tests for persistence, resolver behavior, CLI commands, status, and prompts.
- Documented create/link/unlink/status task-link commands in `README.md`.
- Tightened `link`/`unlink` argument validation so positional source/target forms cannot be mixed with current-task `--to` shorthand.
- Added create-time self-link prevention when a new task slug matches a resolved `--parent` or `--after` target.

## Files Changed

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
- `README.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/spec.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/spec_validation.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/plan.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/plan_validation.md`
- `docs/features/github_issue_84_lightweight_task_links_implementation/result.md`

## Validation Performed

- `pnpm install`
- `pnpm build`
- `pnpm test tests/integration/task-links.test.ts`
- `pnpm test`
- Re-ran `pnpm build` and `pnpm test` after safe-refactor review fixes.
- Re-ran `pnpm build` and `pnpm test` again after create-time self-link prevention.

Full test result:

- 23 test files passed.
- 386 tests passed.

Manual smoke validation in `/volume2/PJ/playspec-issue-84-smoke`:

- Initialized a workspace.
- Created a parent task.
- Created child tasks with `--parent` and `--after`.
- Confirmed parent status showed direct `Includes` and `Suggested next`.
- Confirmed prompt output for a linked child included `Linked task context`.
- Confirmed child YAML stored outgoing links only.
- Confirmed `playspec link` and `playspec unlink` mutate direct links.

Post-review fixes:

- Rejected mixed positional plus `--to` usage for `link` and `unlink`.
- Expanded tests for `Followed by`, `Related by`, open candidates, completed-task resolver coverage, prompt `After` and `Related` sections, invalid link types, unlink-all behavior, and mixed argument rejection.
- Added README command examples for lightweight task links.
- Added create-time self-link guard and test coverage.

## Quality Gate

Implementation quality score: 96/100.

Evidence:

- All approved spec and plan runtime paths are implemented.
- Focused task-link tests cover state persistence, mutation, output, and prompt behavior.
- Full build and test suite pass.
- Manual CLI smoke test covered real user-visible paths.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/85

## Remaining Risks

- Suggested-next remains intentionally simple and direct-only. It is not a scheduler.
- Archived task link resolution/display remains out of scope for v1.
