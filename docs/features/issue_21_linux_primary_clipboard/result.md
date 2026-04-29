# Issue 21 Linux PRIMARY Clipboard Result

## Files Changed

- `src/utils/clipboard.ts`
- `src/utils/clipboard-message.ts`
- `src/cli/commands/prompt.ts`
- `src/cli/commands/next.ts`
- `tests/unit/clipboard.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_21_linux_primary_clipboard/spec.md`
- `docs/features/issue_21_linux_primary_clipboard/plan.md`

## Behavior Implemented

- Regular CLIPBOARD copy behavior remains the primary success path.
- On Linux, successful native clipboard writes now attempt PRIMARY selection best-effort.
- On Linux, successful fallback CLIPBOARD command writes now attempt PRIMARY selection best-effort.
- PRIMARY candidates run in this order: `wl-copy --primary`, `xclip -selection primary`, `xsel --primary --input`.
- PRIMARY is not attempted when regular CLIPBOARD fallback commands all fail.
- PRIMARY failures do not fail a successful regular CLIPBOARD copy.
- `playspec prompt`, `playspec complete` post-phase prompt output, and deprecated `playspec next --copy` preserve the existing first success line and add PRIMARY status when known.

## Verification Performed

- `pnpm build` passed.
- `pnpm test` passed: 17 test files, 272 tests.
- `pnpm dev desync-check` exited 0 and reported medium severity because implementation changes were intentionally uncommitted at the time of the check.
- Post-implementation spec verification passed for issue scope.
- Refactor guard initially flagged a cross-boundary relative test import; fixed by moving copy message formatting to `src/utils/clipboard-message.ts` and using `#utils/clipboard-message.js`.
- Build validation passed after the import fix.

## Focused Test Coverage

- `tests/unit/clipboard.test.ts` covers disabled clipboard behavior, native Linux PRIMARY success, native Linux PRIMARY unavailable behavior, non-Linux native copy behavior, PRIMARY candidate ordering, fallback CLIPBOARD success followed by PRIMARY, and no PRIMARY attempt when fallback CLIPBOARD commands all fail.
- `tests/cli.test.ts` covers prompt-copy success message formatting for PRIMARY updated, PRIMARY unavailable, and unknown/non-Linux status.
- Focused command run: `pnpm test -- tests/unit/clipboard.test.ts` passed.
- Focused command run: `pnpm test -- tests/unit/clipboard.test.ts tests/cli.test.ts -t 'formats prompt copy success'` passed for the formatter case.
- Full command run after final wiring changes: `pnpm test` passed, 17 files and 272 tests.

## Remaining Risks

- Actual PRIMARY behavior depends on installed desktop clipboard tools and the user session. Missing tools are intentionally non-fatal and produce an unavailable warning when regular CLIPBOARD copy succeeds.
- `desync-check` medium severity is expected until the implementation is committed and the PlaySpec phase is completed.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- The only cleanup applied during implementation was extracting prompt copy success text into `src/utils/clipboard-message.ts` so CLI commands and tests can share formatting through a path alias.
- No further safe refactors were applied; the remaining diff is already narrow and directly tied to issue #21.
- Focused verification after review passed: `pnpm test -- tests/unit/clipboard.test.ts` and the formatter-focused CLI test.

## PR Preparation

- Draft PR notes were written to `docs/features/issue_21_linux_primary_clipboard/pr.md`.
- Reusable agent guidance decision: no AGENTS.md update needed because this was a narrow clipboard behavior change, not a recurring repository workflow rule.
- Branch to push: `agent/issue-21-linux-primary-clipboard`.
