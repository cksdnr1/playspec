# Issue 21 Linux PRIMARY Clipboard Implementation Plan

## Goal

Make `playspec prompt` preserve existing regular clipboard behavior while also attempting Linux PRIMARY selection after any successful regular clipboard copy. PRIMARY failures must be best-effort warnings only.

## Files To Edit

- `src/utils/clipboard.ts`
- `src/cli/commands/prompt.ts`
- `src/cli/commands/next.ts`
- `tests/unit/clipboard.test.ts`
- `tests/cli.test.ts` only if an existing CLI assertion needs updating

## Ordered Steps

1. Update `copyToClipboard()` in `src/utils/clipboard.ts`.
   - Keep `PLAY_SPEC_DISABLE_CLIPBOARD=1` behavior unchanged.
   - After `clipboard.write(text)` succeeds, call the Linux PRIMARY helper and return `primaryOk` on Linux.
   - Keep non-Linux native success returning `primaryOk: undefined`.
   - Keep fallback command and OSC52 behavior unchanged except for moving PRIMARY attempts to occur only after a regular fallback CLIPBOARD command succeeds.

2. Update fallback command ordering in `copyWithPlatformCommand()`.
   - Do not call `tryLinuxPrimary()` if no regular platform CLIPBOARD command succeeded.
   - If a regular platform CLIPBOARD command succeeds, then call `tryLinuxPrimary()` on Linux and return `ok: true` with `primaryOk`.
   - If no regular platform CLIPBOARD command succeeds, return `ok: false` without attempting PRIMARY so PRIMARY never updates stale middle-click content when CLIPBOARD failed.

3. Expand PRIMARY command candidates.
   - Try `wl-copy --primary` first.
   - Then try `xclip -selection primary`.
   - Then try `xsel --primary --input`.
   - Keep the timeout short and swallow PRIMARY errors so missing tools never fail CLIPBOARD success.

4. Add prompt-copy message formatting in `src/cli/commands/prompt.ts`.
   - Preserve the existing first success line: `Prompt copied to clipboard...`.
   - If `primaryOk === true`, print `PRIMARY selection updated.`
   - If `primaryOk === false`, print `Warning: PRIMARY selection not available; CLIPBOARD copy succeeded.`
   - Export a small helper if needed so the message behavior is unit-testable without real clipboard access.

5. Reuse the prompt message helper from `src/cli/commands/next.ts`.
   - Keep `next` deprecated behavior and fallback behavior unchanged.
   - Only align success output when `copyToClipboard()` succeeds.

6. Add deterministic tests.
   - Mock `clipboardy` and `execa` in `tests/unit/clipboard.test.ts`.
   - Cover native CLIPBOARD success plus PRIMARY success.
   - Cover native CLIPBOARD success plus missing PRIMARY tools returning `ok: true` and `primaryOk: false`.
   - Cover non-Linux native CLIPBOARD success with no PRIMARY attempts.
   - Cover PRIMARY candidate ordering.
   - Cover disabled clipboard remains unchanged.
   - Cover prompt success message formatting for `primaryOk: true`, `primaryOk: false`, and `undefined`.
   - Cover that PRIMARY is not attempted when all regular fallback CLIPBOARD commands fail.

## Behavior Trace

- Active path: `playspec prompt` -> `runPrompt()` -> `outputPrompt()` -> `copyToClipboard()` -> regular CLIPBOARD success -> Linux PRIMARY attempt -> user-visible copy line plus PRIMARY status line.
- Completion path: `playspec complete` -> `outputPrompt()` uses the same success formatting.
- Deprecated path: `playspec next --copy` -> `copyToClipboard()` -> same success formatting.
- Bypass paths: `--no-copy` and `--print-only` never call clipboard code.
- Failure path: if regular CLIPBOARD copy fails and OSC52 is unavailable, fallback prompt writing remains unchanged.

## Risks

- Host clipboard tools vary by environment. Mitigation: PRIMARY command failures are swallowed and tested through mocked `execa`.
- `process.platform` mutation in tests can leak. Mitigation: restore platform descriptor after each test.
- Output changes could surprise scripts. Mitigation: preserve existing first success line and add PRIMARY status on a second line only when Linux PRIMARY was attempted.

## Validation Ledger

- Resolved blocker: fallback command path must attempt PRIMARY only after a regular CLIPBOARD command succeeds. The plan now requires no PRIMARY attempt when all regular fallback CLIPBOARD commands fail.
- Remaining risk: deterministic output tests should avoid real host clipboard behavior. Keep helper/formatter tests as the preferred target.
- Approval recommendation after this patch: approved if revalidation finds no new ordering or scope issues.

## Rollback Notes

Revert edits in `src/utils/clipboard.ts`, `src/cli/commands/prompt.ts`, `src/cli/commands/next.ts`, and related tests. No data migrations or persistent state changes are involved.

## Completion Criteria

- `playspec prompt` regular clipboard success remains successful.
- On Linux regular success also attempts PRIMARY best-effort.
- Missing PRIMARY tools do not fail the command.
- Prompt output shows PRIMARY updated or unavailable when status is known.
- `pnpm build`, `pnpm test`, and `pnpm dev desync-check` pass.
