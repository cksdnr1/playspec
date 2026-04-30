# Issue 29 Selection Prompt Redraw Wrap Bug - Implementation Plan

## Ordered Steps

1. Add a shared selector module at `src/cli/interactive-selector.ts`.
   - Export `selectInteractiveItem<T>()` for command use.
   - Export pure helpers for tests: render-state creation, visual row counting, label truncation, and key-driven selection state.
   - Keep prompt text configurable so existing command headers remain unchanged.

2. Implement wrap-safe rendering.
   - Derive terminal width from `stdout.columns`, falling back to 80 and clamping to at least 1.
   - Truncate option label content to fit a single row with marker prefix when width allows.
   - Preserve item payload separately from visible label.
   - Track rendered visual rows for header, each option row, and footer.
   - On redraw, move up by the previous rendered visual row count and clear from cursor down before writing the next frame.

3. Centralize raw-mode key handling.
   - Preserve Up/Down wraparound.
   - Preserve Enter selection.
   - Preserve Esc and Ctrl+C cancellation.
   - Restore cursor visibility, raw mode, and stdin pause behavior.

4. Replace command-local selectors.
   - `src/cli/commands/specs.ts`: map relevant file candidates to `{ value: candidate, label }`; cancellation throws `Cancelled. No file selected.`.
   - `src/cli/commands/use.ts`: map task summaries to `{ value: task, label }`; cancellation throws `Cancelled. No task selected.`.
   - `src/cli/commands/phase.ts`: map phases to `{ value: phaseId, label }`; cancellation returns `null` to preserve current CLI output.

5. Add focused tests.
   - `tests/unit/interactive-selector.test.ts`:
     - Long labels are truncated for a narrow width and do not wrap.
     - Visual row count includes wrapped header/footer for extremely narrow widths.
     - Redraw output clears the exact previous visual row count.
     - Up/Down wrap around.
     - Enter returns the original full payload.
     - Esc/Ctrl+C cancel.
   - Keep or update existing CLI PTY tests as command-level regression coverage.

6. Validate.
   - `pnpm build`
   - `pnpm test`
   - If full test runtime exposes environment flake, run focused tests and report the skipped/failing command with evidence.

## Files To Edit

- `src/cli/interactive-selector.ts`
- `src/cli/commands/specs.ts`
- `src/cli/commands/use.ts`
- `src/cli/commands/phase.ts`
- `tests/unit/interactive-selector.test.ts`
- Existing CLI tests only if exact interactive output needs adjustment.

## Active Entry Point Trace

- `playspec specs` -> `runSpecs()` -> relevant candidates -> shared selector -> redraw on arrow key -> original `RelevantFileCandidate` returned -> print/copy/no-copy behavior continues.
- `playspec use` -> `runUse()` -> active task summaries -> shared selector -> redraw on arrow key -> original `TaskSummary` returned -> `.playspec/HEAD` updated.
- `playspec phase --select` -> `runPhase()` -> workflow phases -> shared selector -> redraw on arrow key -> original phase id returned -> confirmation/update flow continues.

## Bypasses And Partial Migration Risks

- Non-interactive `specs --path-only` and `specs --print` must not load the selector.
- Explicit `use <taskId>` must keep direct HEAD update behavior.
- `phase --set` and positional render-only phase commands must remain unchanged.
- Leaving any old local selector implementation in these files would reintroduce the wrap bug, so removal is part of completion.

## Risks

- Unicode width support is limited without a dependency. Current selector labels are plain ASCII-oriented paths and metadata; ANSI stripping plus conservative truncation is sufficient for this issue.
- Very narrow terminals can still wrap fixed header/footer text. The renderer will count those rows so clearing remains correct.
- Raw-mode restore must be identical to existing behavior to avoid leaving the terminal in raw mode after errors.

## Rollback Notes

The change is localized to CLI selector rendering and tests. Rollback is a normal git revert of the shared selector module plus three command imports/usages.

## Completion Criteria

- Shared selector module is the only selector implementation for `specs`, `use`, and `phase --select`.
- Long option labels do not leave stale fragments or duplicate headers after repeated Up/Down.
- Selected payload remains the full original object/string.
- Enter, Esc, and Ctrl+C behavior is preserved.
- `pnpm build` and `pnpm test` pass.

## Validation Risk Ledger

### Blockers

None. The plan is scoped to the approved spec and active selector paths.

### Medium Risks

- Risk: The shared helper could accidentally change command-specific cancellation wording.
  - Minimal patch: Accept a command-specific `cancelMessage` option and keep existing messages.
- Risk: Unit tests may verify pure render behavior but miss actual PTY command wiring.
  - Minimal patch: Keep existing PTY tests passing and add focused pure tests for the redraw math.

### Low Risks

- Risk: Unicode display width is not exact.
  - Minimal patch: Strip ANSI and handle printable ASCII paths conservatively; document this as sufficient for current labels.
- Risk: Footer/header can wrap in extremely narrow terminals.
  - Minimal patch: Count visual rows for every rendered line, not only option rows.

### Recommended Minimal Patches

- Keep the shared selector API small: `items`, `header`, `footer`, `cancelMessage`, and optional streams for testability.
- Export only pure render helpers that tests need.
- Avoid adding dependencies unless implementation proves the plain helper cannot satisfy acceptance.

### Unresolved Blockers

None.

### Gate Recommendation

Approved. The next step should be completed with `playspec complete --result approved`.
