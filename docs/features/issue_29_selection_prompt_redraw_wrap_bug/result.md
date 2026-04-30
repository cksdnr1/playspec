# Issue 29 Selection Prompt Redraw Wrap Bug - Result

## Files Changed

- `src/cli/interactive-selector.ts`
- `src/cli/commands/specs.ts`
- `src/cli/commands/use.ts`
- `src/cli/commands/phase.ts`
- `tests/unit/interactive-selector.test.ts`
- `docs/features/issue_29_selection_prompt_redraw_wrap_bug/spec.md`
- `docs/features/issue_29_selection_prompt_redraw_wrap_bug/plan.md`

## Behavior Implemented

- Added a shared interactive selector for CLI raw-mode pickers.
- Centralized Up/Down, Enter, Esc, Ctrl+C, raw-mode restore, cursor restore, and redraw clearing.
- Truncated visible option labels to fit the terminal width where possible.
- Tracked previous render height in terminal visual rows before clearing and redrawing.
- Preserved full selected payloads independently from display labels.
- Replaced local selector implementations in `specs`, `use`, and `phase --select`.

## Verification Performed

- `pnpm build` passed.
- `pnpm test tests/unit/interactive-selector.test.ts` passed.
- `pnpm test tests/unit/interactive-selector.test.ts tests/cli.test.ts -- --testNamePattern "selects an active task|shows effective|phase --select|interactive selector"` passed.
- `pnpm test` reached 284/285 passing, then one existing workflow-assets CLI test hit Vitest's default 5s timeout.
- `pnpm test tests/cli.test.ts -- --testNamePattern "lists and shows built-in workflow assets"` passed for that timed-out test alone.
- `pnpm test -- --testTimeout=10000` passed 285/285.
- `pnpm test tests/cli.test.ts -- --testTimeout=10000` passed 120/120.

## Remaining Risks

- Display width handling is conservative for plain CLI labels and strips ANSI escape sequences. It does not implement full Unicode East Asian width semantics.
- The full CLI suite is slow under PTY-heavy tests. The default 5s timeout can be tight under load, so the clean full-suite pass used `--testTimeout=10000`.

## Refactor Review

- Compared the final diff against `origin/master`.
- No additional safe refactor was applied after implementation and tests.
- `refactor_guard` reported the final scope as allowed.
- The only behavior adjacent to the selector extraction is honoring existing `phase --yes` during interactive `phase --select`, which keeps the documented confirmation-bypass option usable for the newly covered command-level selection path.
