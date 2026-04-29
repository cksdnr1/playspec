# Draft PR: Issue 21 Linux PRIMARY Clipboard

Fixes #21

## Summary

- Preserve existing regular CLIPBOARD behavior for `playspec prompt`.
- On Linux, attempt PRIMARY selection best-effort after successful native or fallback regular clipboard copy.
- Add `wl-copy --primary`, `xclip -selection primary`, and `xsel --primary --input` PRIMARY candidates.
- Surface PRIMARY status in `playspec prompt`, `playspec complete` post-phase prompt output, and deprecated `playspec next --copy`.
- Add focused unit coverage for PRIMARY behavior and deterministic message formatting.

## Changed Files

- `src/utils/clipboard.ts`
- `src/utils/clipboard-message.ts`
- `src/cli/commands/prompt.ts`
- `src/cli/commands/next.ts`
- `tests/unit/clipboard.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_21_linux_primary_clipboard/spec.md`
- `docs/features/issue_21_linux_primary_clipboard/plan.md`
- `docs/features/issue_21_linux_primary_clipboard/result.md`

## Tests Run

- `pnpm build`
- `pnpm test`
- `pnpm dev desync-check`
- `pnpm test -- tests/unit/clipboard.test.ts`
- `pnpm test -- tests/unit/clipboard.test.ts tests/cli.test.ts -t 'formats prompt copy success'`

## PlaySpec Task

- `issue_21_linux_primary_clipboard`

## Risk Notes

- PRIMARY support depends on optional desktop tools available in the user's Linux session.
- Missing PRIMARY tools are non-fatal and leave regular CLIPBOARD behavior successful.
- `pnpm dev desync-check` reported medium severity before commit because implementation changes were intentionally uncommitted.

## Reusable Agent Guidance

No reusable AGENTS.md guidance is needed. The change is a narrow implementation of existing clipboard behavior and does not introduce a new recurring repository workflow rule.
