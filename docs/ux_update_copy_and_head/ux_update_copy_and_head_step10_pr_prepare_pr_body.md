## Summary

- **HEAD marker in `list` / `list-tasks`** — both commands now read `.playspec/HEAD` and append `[HEAD]` to the matching task line; missing or stale HEAD is tolerated silently.
- **Context visibility in `current` / `current-task`** — `current` shows linked context paths; `current-task` adds per-ref detail (role, source) and the docs root.
- **Interactive `add-context` without `--task`** — `--task` is now optional; in an interactive TTY the command resolves HEAD, prints the target task and normalized file path, asks for `y/yes` confirmation, then mutates only on approval. Non-interactive execution (no TTY, CI, or `PLAY_SPEC_NON_INTERACTIVE=1`) rejects with a clear hint.
- **`next --out <file>`** — writes the rendered prompt to a user-selected workspace-relative path; parent directory is created automatically; symlink escape is validated. When `--out` or `--copy` is active, the full prompt is suppressed from stdout (status lines only).
- **Clipboard fallback chain** — `copyToClipboard()` now returns a `ClipboardResult` and tries: native `clipboardy` → platform command (`xclip`/`pbcopy`/`xsel`/`clip.exe`) via `execa` with timeout → OSC52 (TTY-only, best-effort) → file fallback written to the task `prompts/` directory. `PLAY_SPEC_DISABLE_CLIPBOARD=1` short-circuits all backends for tests.
- **`phase-display.ts`** — new shared module (`phaseDisplayInfo`, `gateResults`, `gateTargets`, `formatGateRoutes`) used by `next`, `current-task`, and `complete` to render consistent step labels and gate routes.
- **`cli-utils.ts`** — new CLI-only module (`isInteractiveCli`, `readHeadTaskId`, `formatContextRef`, `resolveOutputFilePath`).
- **mono-spec workflow — `gate` block + `stepNumber`/`stepTitle`** — gated phases now use `gate: { results, nextByResult }` to distinguish routing data from plain result lists; `stepNumber` and `stepTitle` fields carry human-readable step metadata. `complete`, `current-task`, and `next` all display step labels and gate routes via `phase-display.ts`.
- **Variable resolver — mono-spec path conventions** — `IMPLEMENTATION_PLAN_FILE`, `IMPLEMENTATION_RESULT_FILE`, `TEST_RESULT_FILE`, and `PR_BODY_FILE` resolve to `docs/<slug>/<slug>_step{N}_{id}_<artifact>.md` for mono-spec tasks; legacy workflow paths are unchanged.
- **EPIPE handling** — `src/cli/index.ts` installs `process.stdout.on('error')` and `process.stderr.on('error')` handlers that exit cleanly on EPIPE and re-throw all other errors.

## Changed files

| File | Change |
|---|---|
| `src/cli/index.ts` | EPIPE handlers; `add-context --task` optional; `next --out` registered |
| `src/cli/cli-utils.ts` | New: `isInteractiveCli`, `readHeadTaskId`, `formatContextRef`, `resolveOutputFilePath` |
| `src/cli/commands/add-context.ts` | Optional `--task`; interactive HEAD fallback with confirmation |
| `src/cli/commands/list.ts` | `[HEAD]` marker |
| `src/cli/commands/list-tasks.ts` | `[HEAD]` marker |
| `src/cli/commands/current.ts` | Context paths in compact view |
| `src/cli/commands/current-task.ts` | Rich context detail, step label, gate routes |
| `src/cli/commands/next.ts` | `--out`; resolved phase line; copy/fallback rewrite; suppressed full prompt on `--copy`/`--out` |
| `src/cli/commands/complete.ts` | Step labels via `phaseDisplayInfo` for completed and next phase |
| `src/workflow/phase-display.ts` | New: display helpers |
| `src/utils/clipboard.ts` | Multi-backend `ClipboardResult`; `PLAY_SPEC_DISABLE_CLIPBOARD` |
| `src/core/types.ts` | `PhaseDefinition.stepNumber`, `stepTitle`, `gate` |
| `src/core/schemas.ts` | `PhaseGateSchema`; `stepNumber`, `stepTitle`, `gate` fields |
| `src/template/variable-resolver.ts` | `STEP_NUMBER`, `STEP_ID`, `STEP_TITLE`; mono-spec artifact paths |
| `src/preset/assets/default/workflows/mono-spec.yaml` | `stepNumber`/`stepTitle` on all phases; `gate` blocks on `tech_spec_patch` and `implementation_plan_patch` |
| `src/preset/assets/default/templates/mono-spec/*.md` | Variable references updated to `STEP_NUMBER`/`STEP_ID`/`STEP_TITLE` |
| `tests/cli.test.ts` | Coverage for HEAD marker, context display, add-context modes, `--out`, copy fallback, step metadata, gate routes |
| `tests/integration/*.test.ts` | Regression coverage updated |
| `tests/unit/variable-resolver.test.ts` | Mono-spec path assertions |
| `tests/unit/clipboard.test.ts` | New: `ClipboardResult` and fallback behavior |

## Test plan

- [x] `playspec list` and `playspec list-tasks` show `[HEAD]` on the current task; no error when HEAD is absent.
- [x] `playspec current` prints context paths when refs are present.
- [x] `playspec current-task` prints per-ref detail and docs root.
- [x] `playspec add-context <file>` without `--task` fails with exit 1 and a clear message in non-interactive mode; no mutation occurs.
- [x] `playspec add-context <file> --task <id>` works in non-interactive mode without prompting.
- [x] `playspec next --out tmp/prompt.md` writes file, prints status line, does not dump prompt to stdout.
- [x] `playspec next --copy` with `PLAY_SPEC_DISABLE_CLIPBOARD=1` writes fallback file, does not dump prompt to stdout.
- [x] `playspec next --copy --out <file>` with disabled clipboard writes `--out` file, no extra fallback file.
- [x] `playspec next` on mono-spec `tech_spec_patch` prints step metadata and gate routes.
- [x] `playspec current-task` on mono-spec step shows `Step:`, `Step ID:`, and gate routes.
- [x] `playspec complete --result approved` on mono-spec step prints step labels for completed and next phase.
- [x] Integration tests: init/create/next, routing, workflow-loader, variable-resolver all pass.

## Limitations and unresolved risks

- **Interactive `add-context` confirmation path** — end-to-end test for the interactive `y/N` prompt is absent; TTY simulation in the test harness is fragile. The non-interactive rejection and explicit `--task` paths are covered.
- **OSC52 clipboard** — OSC52 attempts are best-effort and unverifiable; success is reported as `attempted: true`. No end-to-end test confirms terminal reception.
- **Platform command clipboard backends** — `xclip`, `pbcopy`, `xsel`, `clip.exe` coverage is unit-tested via mock; real host availability is not tested in CI.
- **MCP boundary** — MCP still uses `resolveMcpTaskId()` and is not affected by these changes. Regression guard exists in integration tests but is not expanded.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
