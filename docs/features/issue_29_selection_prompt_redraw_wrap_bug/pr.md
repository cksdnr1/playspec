# PR: Fix Interactive Selector Redraw For Wrapped Labels

Fixes #29

## Summary

- Added a shared `selectInteractiveItem()` implementation for CLI raw-mode selectors.
- Replaced duplicated selector render/key handling in `playspec specs`, `playspec use`, and `playspec phase --select`.
- Truncated visible option labels to fit the terminal width while returning the full original selected payload.
- Tracked rendered visual rows and clears that exact height before redraw, preventing stale wrapped fragments and duplicated headers.
- Honored existing `phase --yes` during interactive `phase --select` so command-level successful selection can bypass the follow-up confirmation prompt.

## Changed Files

- `src/cli/interactive-selector.ts`
- `src/cli/commands/specs.ts`
- `src/cli/commands/use.ts`
- `src/cli/commands/phase.ts`
- `tests/unit/interactive-selector.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_29_selection_prompt_redraw_wrap_bug/spec.md`
- `docs/features/issue_29_selection_prompt_redraw_wrap_bug/plan.md`
- `docs/features/issue_29_selection_prompt_redraw_wrap_bug/result.md`
- `docs/features/issue_29_selection_prompt_redraw_wrap_bug/pr.md`

## Tests Run

- `pnpm build`
- `pnpm test tests/unit/interactive-selector.test.ts`
- `pnpm test tests/unit/interactive-selector.test.ts tests/cli.test.ts -- --testNamePattern "selects an active task|shows effective|phase --select|interactive selector"`
- `pnpm test` (284/285 passed, then one CLI workflow-assets test hit the default 5s timeout)
- `pnpm test tests/cli.test.ts -- --testNamePattern "lists and shows built-in workflow assets"`
- `pnpm test -- --testTimeout=10000`
- `pnpm test tests/cli.test.ts -- --testTimeout=10000`

## PlaySpec Task

- `issue_29_selection_prompt_redraw_wrap_bug`

## Risk Notes

- Display width handling is conservative: ANSI is stripped and labels are truncated by code point count, not full East Asian display-width semantics.
- PTY-heavy CLI tests are slow in this environment. The default 5s per-test timeout was tight under full-suite load; the full suite passed with `--testTimeout=10000`.

## Reusable Agent Guidance

No new reusable agent guidance is needed. The repository rules already require central shared code paths and scoped PlaySpec workflow execution.
