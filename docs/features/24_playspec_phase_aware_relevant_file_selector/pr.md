## Summary

Add a read-only `playspec specs` command that discovers relevant task files from live task/workflow/template context and lets users list paths, print file contents, or interactively select and copy a file — without mutating any task state or writing fallback files.

### What changed

- **`src/core/relevant-files.ts`** (new) — pure candidate discovery from six prioritized sources: explicit `contextRefs`, files under `task.paths.taskRoot/sources/`, resolved `_FILE`/`_PATH`/`_DOC` variables, workflow `requiredVariables` and `outputs`, backtick-parsed paths in the rendered phase prompt, and existing files under `task.paths.projectDocRoot`. Normalizes, deduplicates, and classifies each candidate as `exists` or missing. Warns on absolute paths, URL values, placeholder strings, shell-looking values, template-internal paths, workspace-escaping paths, and symlink escapes without failing the whole discovery run.
- **`src/cli/commands/specs.ts`** (new) — `runSpecs()` command handler wiring discovery to six output behaviors: `--path-only`, `--path-only --show-missing`, non-interactive `--print` with `===== path =====` separators, interactive selector with clipboard copy (default), interactive `--print`, and interactive `--no-copy`. Enforces the 1 MiB large-file policy, validates UTF-8 before any content output, and emits all non-data output to stderr to keep stdout script-safe.
- **`src/cli/index.ts`** — registers `specs` with `--task`, `--print`, `--path-only`, `--no-copy`, `--show-missing`, `--force-large`.
- **`tests/unit/relevant-files.test.ts`** (new) — unit coverage for discovery priority, deduplication, variable classification, backtick parsing, missing-file classification, invalid/escaped/placeholder/URL/shell/template/symlink-escape rejection, mono-spec and legacy workflow variable support, and render-degraded fallback behavior.
- **`tests/cli.test.ts`** — CLI coverage for `--path-only`, `--task` without HEAD mutation, `--show-missing` stderr isolation, non-interactive failure hint, non-interactive `--print` separators, binary/large-file skipping with `--path-only` still listing the path, and interactive `--no-copy` without task/HEAD mutation.

### Entry point → behavior chain

```
playspec specs
  → ActiveTaskResolver resolves HEAD / --task
  → PhaseResolver.resolveCurrentPhase (null = first phase, no mutation)
  → discoverRelevantFiles (context refs → sources dir → variables → workflow → rendered prompt → projectDocRoot)
  → existing candidates → interactive selector / --path-only / --print
  → copyToClipboard / console.log / stderr only
  → no task.yaml, HEAD, snapshot, evidence, or fallback file writes
```

### Key invariants verified

- `discoverRelevantFiles` is pure/read-only at runtime; no prompt snapshot, task mutation, or fallback file is written.
- Rendered prompt is rendered directly via `TemplateRenderer`, not `PlaySpecCore.renderNextPrompt()`, to avoid the context-ref assertion that would fail discovery when one ref is missing.
- Recovery: render failure produces degraded discovery + stderr warning; the command continues with context refs, variables, and projectDocRoot candidates.
- Non-interactive mode without `--path-only` or `--print` fails with an explicit hint — no silent empty output.
- Missing expected files hidden by default; shown with `--show-missing` routed to stderr, keeping stdout script-safe.
- Clipboard failure does not write fallback files; it fails with a rerun hint.
- Interactive selector restores raw mode, cursor visibility, and stdin listeners on select, cancel, and error.

### Limitations and open risks

- **Project-doc-root fallback is not phase-filtered** — all existing files under `task.paths.projectDocRoot` are included as low-priority candidates. A future phase could narrow to files referenced by the current phase prompt. (R8 in spec risk ledger.)
- **CLI tests do not cover clipboard failure or interactive large-file confirmation** — these branches are exercised in unit tests and `--no-copy`/`--print` paths, but no PTY test drives the exact clipboard-failure → hint path or interactive large-file `[y/N]` prompt.
- **`PLAY_SPEC_NON_INTERACTIVE=1`** is used in CLI tests to suppress the interactive selector without a real TTY.

## Test plan

- [ ] `npm test -- tests/unit/relevant-files.test.ts` — all discovery unit tests pass
- [ ] `npm test -- tests/cli.test.ts -t specs` — all CLI specs tests pass
- [ ] `npm run build` — TypeScript build is clean
- [ ] `playspec specs --path-only` on a real workspace with an active HEAD task lists relevant existing files
- [ ] `playspec specs --print` in non-interactive mode prints all existing UTF-8 candidates with `=====` separators
- [ ] `playspec specs` in non-interactive mode (no TTY) exits with a clear hint
- [ ] `playspec specs --path-only --show-missing` keeps stdout clean and reports missing files on stderr
- [ ] Interactive `playspec specs --no-copy` presents a selector, reports selected path, does not mutate task state
