# 22-playspec_use_interactive_selector_issue Result

## Files Changed

- `src/cli/index.ts`
- `src/cli/commands/use.ts`
- `tests/cli.test.ts`
- `README.md`
- `docs/features/22_playspec_use_interactive_selector_issue/pr.md`
- `docs/features/22_playspec_use_interactive_selector_issue/result.md`

## Behavior Implemented

- `playspec use <taskId>` still validates the task through `YamlTaskStore.getTask()` and writes only `.playspec/HEAD`.
- `playspec use` now reaches command logic because the Commander argument is optional.
- In non-interactive mode, no-argument `use` fails with `Missing taskId.` and the recovery commands to list tasks and pass an explicit task ID.
- In an interactive terminal, no-argument `use` lists active tasks in an arrow-key selector, marks the current HEAD with `[HEAD]`, and shows workflow type, title, and effective phase display.
- Selecting a task routes through the same validation and HEAD write helper as the explicit path, then prints both `HEAD set to: <taskId>` and the selected task title.
- Escape and Ctrl+C cancel the selector as a controlled error with `Cancelled. No task selected.` and do not write HEAD.
- Selector cleanup restores raw mode, cursor visibility, input listeners, and stdin pause state for Enter, cancellation, and unexpected selector errors.
- Interactive no-argument `use` with no active tasks fails with `No active tasks found.` and the create-task hint without mutating HEAD.
- README command documentation now lists both `playspec use` and `playspec use <taskId>`.

## Verification Performed

- `pnpm vitest run tests/cli.test.ts -t "use" --testTimeout 15000`
  - Passed 8 focused `use` tests, including explicit use, non-interactive no-arg failure, PTY arrow-key selection, cancellation, empty active-list handling, effective phase display, invalid phase display, and task read-only checks.
- `pnpm build`
  - Passed TypeScript build, alias rewrite, and preset asset copy.
- `pnpm test`
  - Failed after 15 files and 217 tests passed because `tests/cli.test.ts > CLI placeholder > marks the HEAD task in list and list-tasks output` hit the default 5000ms timeout.
- `pnpm test -- --testTimeout 15000`
  - Passed all 16 test files and 218 tests.
- `spec_verifier` post-implementation check
  - Confirmed the active entry point, explicit path, non-interactive failure, selector display, selection-to-HEAD update, cancellation/reset path, user-visible output, and HEAD-only mutation requirements are covered.
  - Noted that Ctrl+C shares the implemented cancellation path but only Escape cancellation has focused PTY coverage.
  - Noted that missing `contextRefs` are not validated by the `use` path, but there is no focused regression test that constructs missing context refs.
  - Initially flagged raw-mode cleanup for unexpected selector errors and README documentation as partial; both were addressed before final validation.
- `refactor_guard` post-implementation check
  - Reported the current worktree as allowed.
- `build_validator` post-implementation check
  - Reported `pnpm build` success and the plain `pnpm test` default-timeout failure above.

## PR Preparation

- PR draft written to `docs/features/22_playspec_use_interactive_selector_issue/pr.md`.
- PR link: https://github.com/cksdnr1/playspec/pull/23
- Reusable agent guidance decision: no new reusable agent guidance should be documented. Existing project guidance already covers scoped implementation, subagent verification, and build validation. The reusable lesson here is a feature-specific terminal-selector testing caveat, which is captured in this result and PR draft rather than promoted to a global rule.

## Remaining Risks

- The selector uses a small raw-mode implementation rather than an external prompt library. It is covered by pseudo-terminal tests for arrow selection and cancellation, but terminal behavior can vary across platforms.
- The pseudo-terminal tests use the Unix `script` command, which matches the current test environment but may need adjustment on environments where `script` is unavailable.
- Ctrl+C cancellation is implemented through the same selector cancellation path as Escape, but the focused PTY regression test exercises Escape only.
- The `use` command does not validate context ref targets, which preserves the required behavior, but there is no focused test with missing context refs.
- `docs/features/22_playspec_use_interactive_selector_issue/plan.md` was requested as source material but is not present in this branch. PR preparation used `spec.md`, `result.md`, the source problem, and the current diff against `origin/master`.
