# ui_ux_update_260427 — Implementation Result

## Files Changed

### New Files
- `src/cli/commands/prompt.ts` — Canonical `playspec prompt` command with copy-by-default semantics. Exports `runPrompt`, `outputPrompt`, and `renderPromptWithContext` shared helpers.

### Modified Files
- `src/cli/index.ts` — Registered `prompt` command; kept `next` as deprecated alias; added `get-task --json`; made `add-context [file]` optional with `--edit`; added `complete --no-copy`.
- `src/cli/commands/next.ts` — Deprecated wrapper that prints warning to stderr and preserves old output semantics (body printed unless `--copy` or `--out`).
- `src/cli/commands/complete.ts` — After phase completion, renders next prompt using `outputPrompt` (copy by default). On render failure, prints recovery hint to stderr without rolling back.
- `src/cli/commands/add-context.ts` — Added `--edit` support: opens `$EDITOR` for a generated task-local context note, then links through Core. File argument is now optional.
- `src/cli/commands/current-task.ts` — Uses `resolveEffectivePhaseDisplay`; shows first workflow phase as effective when `currentPhase` is null; shows `INVALID (...) — allowed: ...` for unknown phases.
- `src/cli/commands/list-tasks.ts` — Uses `resolveEffectivePhaseDisplay`; same effective/invalid phase behavior.
- `src/cli/commands/get-task.ts` — Uses `resolveEffectivePhaseDisplay`; added `--json` flag to emit raw task JSON.
- `src/cli/commands/current.ts` — Deprecated; prints warning to stderr; uses effective phase display; preserves old "Context:" output format.
- `src/cli/commands/list.ts` — Deprecated; prints warning to stderr; delegates to `runListTasks`.
- `src/cli/cli-utils.ts` — Added `EffectivePhaseDisplay` interface, `computeEffectivePhaseDisplay`, and `resolveEffectivePhaseDisplay`.
- `src/utils/clipboard.ts` — Added `primaryOk` field to `ClipboardResult`; added `tryLinuxPrimary` for best-effort PRIMARY selection on Linux.
- `tests/cli.test.ts` — Added 19 new tests covering all new behaviors.

## Behavior Implemented

### `playspec prompt` (new canonical command)
- Copies to clipboard by default.
- `--no-copy`: prints prompt body to stdout, no clipboard.
- `--print-only`: raw prompt body to stdout only (no metadata), no clipboard.
- `--out <file>`: writes prompt to file (copy still attempted by default).
- `--task`, `--quiet`, `--write`: same as `next`.
- Read-only: does not mutate `task.yaml`.

### `playspec next` (deprecated)
- Prints `Warning: \`playspec next\` is deprecated. Use \`playspec prompt\` instead.` to stderr.
- Preserves old output semantics: body printed unless `--copy` or `--out` given.
- Uses shared `renderPromptWithContext` helper.

### `playspec complete` post-completion prompt
- After successful phase completion, if `nextPhase` is non-null, reloads the updated task and renders the next prompt via `outputPrompt` (copy by default, `--no-copy` to suppress).
- If rendering fails after completion, prints warning and recovery hint to stderr. Does not roll back.

### `playspec add-context --edit`
- File argument is now optional.
- `--edit`: opens `$EDITOR` for a generated task-local path (`.playspec/tasks/active/<id>/sources/context_note_<timestamp>.md`), then links the file through `PlaySpecCore.addContextRef`. All validation rules preserved.

### Effective phase display
- `current-task`, `list-tasks`, `get-task`: `currentPhase: null` now shows the first workflow phase with `(effective)` suffix instead of `(not started)`.
- Unknown non-null phases show `INVALID (phase) — allowed: p1, p2, ...`.
- Shared helper `resolveEffectivePhaseDisplay` in `cli-utils.ts`.

### `playspec get-task --json`
- Emits the full task record as formatted JSON.

### `playspec current` / `playspec list` deprecation
- Both print a deprecation warning to stderr.
- `current` uses effective phase display; preserves old "Context:" format.
- `list` delegates to `runListTasks`.

### Linux PRIMARY clipboard
- `copyToClipboard` now attempts PRIMARY selection (`xclip -selection primary` or `xsel --primary --input`) on Linux after the CLIPBOARD attempt.
- `ClipboardResult.primaryOk` indicates whether PRIMARY was set.
- PRIMARY failure is non-fatal.

## Verification Performed

- `npx tsc --noEmit`: clean compile.
- `npx vitest run tests/cli.test.ts`: 79/79 passed (60 pre-existing + 19 new).
- `npx vitest run tests/integration/`: 97/97 passed.
- New tests cover: `prompt` copy-default, `--no-copy`, `--print-only`, `--out`, `next`/`current`/`list` deprecation warnings, `complete` post-completion prompt (with and without `--no-copy`), read-only mutation checks for `prompt`/`current-task`/`list-tasks`/`get-task`, effective phase display (null → first phase), invalid phase with allowed IDs, `get-task --json`.

## Remaining Risks

- `complete` post-completion prompt rendering uses copy-by-default. Users who run `complete` in scripts may see additional output and an unexpected fallback file written. Use `complete --no-copy` for script-safe operation.
- Linux PRIMARY clipboard support depends on `xclip`/`xsel` being installed; failure is silently swallowed (by design).
- `add-context --edit` opens `$EDITOR` synchronously via `spawnSync`. If `$EDITOR` is unset and `vi` is unavailable, the command fails with a clear error message.
- The `outputPrompt` helper loads the workflow on every call for phase metadata. In performance-sensitive contexts, this adds one file read per invocation.
