Fixes #159

## Summary

- Add a core active-source guard to `PlaySpecCore.addTaskLink()` and `PlaySpecCore.removeTaskLink()`.
- Cover explicit completed source rejection for `playspec link` and `playspec unlink`.
- Cover HEAD-based `--to` rejection when HEAD points at a completed source task.
- Assert completed source task YAML remains unchanged after each rejected mutation.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/integration/task-links.test.ts`
- `docs/features/issue_159_completed_source_link_guard/spec.md`
- `docs/features/issue_159_completed_source_link_guard/plan.md`
- `docs/features/issue_159_completed_source_link_guard/result.md`
- `docs/features/issue_159_completed_source_link_guard/pr.md`

## Tests Run

- `pnpm vitest run tests/integration/task-links.test.ts`
- `pnpm vitest run tests/cli.test.ts`
- `pnpm build`
- `git diff --check`

## PlaySpec Task

- `issue_159_completed_source_link_guard`

## Risk Notes

- Completed source task link edits now fail with `TaskNotActiveError`. This is intentional for lifecycle safety.
- Target task mutability is unchanged.
- Reusable agent guidance: no new guidance needed; this is a local lifecycle guard using existing core patterns.
