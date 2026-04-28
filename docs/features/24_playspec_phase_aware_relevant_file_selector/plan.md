# Implementation Plan: 24-playspec_phase_aware_relevant_file_selector

## Goal

Add a read-only `playspec specs` command that resolves the current task and effective workflow phase, discovers relevant task files from live task/workflow/template data, and lets users print paths, print contents, or interactively copy selected file contents without mutating task state or writing fallback files.

Primary source of truth:

- `docs/features/24_playspec_phase_aware_relevant_file_selector/spec.md`
- Current repository code

Out of scope for this implementation:

- Viewer UI
- MCP changes
- migration/archive/delete behavior
- task state mutation
- phase completion
- evidence, snapshot, prompt snapshot, or output fallback creation
- auto-applying evolution proposals

## Current Code Anchors

- CLI registration lives in `src/cli/index.ts`.
- Existing HEAD/default task resolution is `ActiveTaskResolver.resolveTask(taskId?)` in `src/core/active-task-resolver.ts`.
- Existing effective phase resolution is `PhaseResolver.resolveCurrentPhase(task, workflow)` in `src/workflow/phase-resolver.ts`; `currentPhase: null` means the first workflow phase without mutating the task.
- Current prompt rendering flow is `PlaySpecCore.renderNextPrompt()` in `src/core/playspec-core.ts`, which loads workflow, resolves phase, resolves variables, renders templates, and asserts context refs exist.
- Variable derivation is `VariableResolver.resolve()` in `src/template/variable-resolver.ts`; it already produces mono-spec stable file variables and legacy workflow file variables.
- Template rendering is `TemplateRenderer.render()` in `src/template/template-renderer.ts`; include expansion is private and render returns only text.
- Clipboard copy is `copyToClipboard()` in `src/utils/clipboard.ts`.
- Existing raw-mode selector behavior is private to `src/cli/commands/use.ts`.
- Interactivity detection and path-safety patterns are in `src/cli/cli-utils.ts`.
- Existing CLI and PTY test patterns are in `tests/cli.test.ts`.

## Data Flow Contract

The implementation must preserve this active flow:

1. Entry point: `playspec specs` in `src/cli/index.ts`.
2. Task resolution: `src/cli/commands/specs.ts` uses `YamlTaskStore` and `ActiveTaskResolver.resolveTask(opts.task)`.
3. Status gate: implicit HEAD requires `task.status === 'active'`, matching `prompt`; explicit `--task` can inspect a readable task.
4. Phase resolution: load workflow through `WorkflowLoader`, then resolve the effective current phase through `PhaseResolver.resolveCurrentPhase()`.
5. Data derivation: resolve variables with `VariableResolver.resolve(task, phaseId, definition)` and render the current phase prompt text read-only for dynamic path discovery using the existing renderer API.
6. Candidate collection: collect paths from context refs, task source files, variables, workflow metadata, rendered prompt text, and existing files under `task.paths.projectDocRoot`.
7. Normalization and validation: workspace-relative candidates are normalized, deduped, classified as existing or missing, checked for workspace escape, and existing files are checked with real paths before read/copy.
8. Propagation: CLI output modes receive the ordered candidate list and warnings from discovery.
9. User-visible behavior:
   - default interactive mode shows existing files in an arrow-key selector and copies selected content.
   - `--path-only` prints existing paths to stdout.
   - `--print` prints selected content interactively or all existing UTF-8 text candidates non-interactively with deterministic separators.
   - `--show-missing` reports missing expected files separately.
   - `--no-copy` avoids clipboard copy and reports or prints according to the selected mode.
10. Reset/clear: selector restores raw mode, cursor visibility, and stdin listeners on select, cancel, and error.
11. Runtime read-only invariant: the `specs` command writes no task, HEAD, workspace docs, prompt, snapshot, evidence, review, result, or fallback files. Tests may create isolated fixtures.

## Implementation Steps

### 1. Add a pure relevant-file discovery module

Create `src/core/relevant-files.ts`.

Responsibilities:

- Export a small data model:
  - `RelevantFileCandidate`
  - `RelevantFileWarning`
  - `RelevantFileDiscoveryResult`
  - `RelevantFileSource`
- Accept explicit inputs: `workspaceRoot`, `task`, `workflow`, `phaseId`, and `definition`.
- Internally resolve variables using `VariableResolver.resolve()`.
- Render current phase prompt only for discovery by constructing `new TemplateRenderer(workspaceRoot)` and calling the existing `render(definition.template, variables)` signature. Do not use `PlaySpecCore.renderNextPrompt()`, because `renderNextPrompt()` asserts context refs and is coupled to prompt behavior.
- If later code needs include/root metadata that `render()` does not expose, add a narrow read-only helper in `src/template/template-renderer.ts` instead of changing prompt behavior.
- Treat recoverable render failures as warnings and continue with context refs, variables, workflow metadata, and project-doc-root files.
- Let invalid current phase remain fatal by relying on `PhaseResolver.resolveCurrentPhase()` before discovery.

Candidate sources and priority:

1. `context-ref`: `task.contextRefs[].path`.
2. `task-source`: existing files under `${task.paths.taskRoot}/sources/`.
3. `variable`: resolved variable names ending in `_FILE`, `_PATH`, or `_DOC`; also parse conservative backticked paths from variables like `CONTEXT_FILES` and `CONTEXT_REFS_DETAIL`.
4. `workflow`: `definition.requiredVariables` values that resolve to path-like variables, and `definition.outputs`.
5. `rendered-prompt`: conservative backticked workspace-relative paths from rendered prompt text.
6. `project-doc-root`: existing text-like files under `task.paths.projectDocRoot`, low priority.

Filtering and classification:

- Accept only workspace-relative paths.
- Reject empty values, placeholders such as `(none)`, `(not provided)`, `(multiple context refs)`, URLs, absolute paths, shell fragments, and paths that normalize outside the workspace.
- Reject `.playspec/templates/**` paths from user-visible candidates.
- Resolve existing candidate real paths and skip with a warning if a symlink escapes the workspace.
- Classify as `exists: true` only for regular files.
- Classify non-existing but valid expected paths as missing; they are omitted from default output and shown only by `--show-missing`.
- Deduplicate by normalized workspace-relative path, preserving the highest-priority source and enough reason metadata for tests and user-facing labels.

### 2. Add reusable selector utility only if needed

Preferred minimal path:

- Create `src/cli/selector.ts` with a generic raw-mode selector if reuse is cleaner than duplicating `use.ts`.
- Migrate `src/cli/commands/use.ts` to call the shared selector without changing its visible labels or cancel behavior.

Fallback path:

- Keep `use.ts` unchanged and implement a command-local selector in `src/cli/commands/specs.ts` if extraction creates avoidable regression risk.

Selector requirements for `specs`:

- Up/Down wraps.
- Enter selects.
- Esc and Ctrl+C cancel with a `PlaySpecError`.
- Always restores raw mode, cursor visibility, stdin listeners, and paused stdin state.
- Shows stable file labels containing path plus concise source/reason.

### 3. Implement the `specs` CLI command

Create `src/cli/commands/specs.ts`.

Options:

- `--task <id>`
- `--print`
- `--path-only`
- `--no-copy`
- `--show-missing`
- `--force-large`

Behavior:

- Resolve task exactly once through `ActiveTaskResolver`.
- Enforce implicit HEAD active-task behavior like `runPrompt()`.
- Load workflow and resolve the effective current phase; do not support an explicit phase option in this feature.
- Call the discovery module and collect warnings.
- Emit discovery warnings to stderr, never stdout.
- Default list contains existing candidates only.
- If no existing candidates are available, fail clearly and include a hint to rerun with `--show-missing` if missing candidates exist.
- Non-interactive plain `playspec specs` fails with a hint to use `--path-only` or `--print`.
- `--path-only` prints existing paths one per line to stdout.
- `--path-only --show-missing` keeps stdout script-safe for existing paths and writes missing paths to stderr under `Missing expected files:`.
- `--print`:
  - interactive: select one existing file, then print its content to stdout.
  - non-interactive: print all existing UTF-8 text candidates in priority order with separators exactly `===== <workspace-relative-path> =====`.
- `--no-copy`:
  - interactive without `--print`: select a file and report the selected path without copying.
  - with `--print`: print content and do not copy.
- Default interactive copy reads selected file content and calls `copyToClipboard()`.
- Clipboard failure must not call prompt fallback helpers or create any file; fail with a hint to rerun with `--print` or `--no-copy`.
- If `copyToClipboard()` returns `ok: true` and `primaryOk === false`, report CLIPBOARD success and a stderr warning only when that result is observable.

Large and non-text handling:

- Define a 1 MiB threshold in the command or discovery module.
- Existing file paths can appear in `--path-only` even if too large or binary.
- Before content output or clipboard copy, validate size and UTF-8 text content.
- Interactive selected file larger than 1 MiB asks for confirmation unless `--force-large` is set.
- Non-interactive `--print` skips files larger than 1 MiB unless `--force-large` is set, warns to stderr, and continues.
- Non-interactive mode has no default copy path; large-file policy applies to non-interactive `--print` output and interactive copy/print selections.
- Binary or non-UTF-8 candidates are skipped for print/copy with stderr warnings.

### 4. Register the command

Edit `src/cli/index.ts`.

- Import `runSpecs`.
- Register `program.command('specs')`.
- Add the six options listed above.
- Route errors through existing `handleError()`.
- Keep option names aligned with the spec, especially `--no-copy` and `--force-large`.

### 5. Avoid prompt-write and explicit-phase bypasses

Do not call these from `specs`:

- `PlaySpecCore.renderNextPrompt()`
- `PlaySpecCore.renderExplicitPhasePrompt()`
- `outputPrompt()`
- `writePromptSnapshot()`
- `writeFallbackPrompt()`
- `completePhase()`
- `collectEvidence()`
- `createSnapshot()`

Reason:

- `renderNextPrompt()` is prompt-specific and asserts context refs, which would make `specs` unusable when one context ref is missing even if other relevant files exist.
- prompt output helpers can write fallback prompt files.
- explicit phase rendering is an old bypass path that can ignore the effective current phase.

### 6. Add focused unit tests for discovery

Add `tests/unit/relevant-files.test.ts`.

Cover:

- Context refs are first-priority candidates.
- Files under `${task.paths.taskRoot}/sources/` are included.
- `_FILE`, `_PATH`, and `_DOC` variables are recognized.
- `CONTEXT_FILES` and rendered prompt backticked paths are parsed conservatively.
- `definition.requiredVariables` and `definition.outputs` contribute expected paths.
- Missing expected files are classified but not mixed with existing files.
- Duplicate paths preserve first/highest-priority source.
- Absolute paths, URLs, placeholders, shell-looking values, workspace escapes, template paths, and symlink escapes produce warnings and are skipped.
- Mono-spec stable docs and non-mono legacy derived files both appear through variables without hardcoded filename tables.
- Recoverable template render failure returns partial candidates plus a warning.

### 7. Add CLI tests

Update `tests/cli.test.ts` or add `tests/cli/specs.test.ts` if splitting keeps the suite clearer.

Cover:

- `playspec specs --path-only` lists existing relevant files for HEAD.
- `playspec specs --task <id> --path-only` resolves the explicit task without changing HEAD.
- `--show-missing` reports expected missing files to stderr, while stdout remains only existing paths.
- non-interactive plain `playspec specs` fails with the output-mode hint.
- `--print` in non-interactive mode prints all existing UTF-8 text candidates with deterministic separators.
- interactive selector can select a file; use deterministic clipboard-disabled behavior or `--no-copy`/`--print` where needed to avoid relying on a real clipboard.
- clipboard failure produces the rerun hint and writes no fallback file.
- invalid candidate paths warn while valid candidates still work.
- binary/non-UTF-8 files are skipped for content output but can still appear in `--path-only`.
- large files are skipped/refused without `--force-large` and included with `--force-large`.
- `specs` does not mutate `.playspec/HEAD`, task `updatedAt`, `phaseHistory`, docs, prompts, evidence, reviews, snapshots, or output files.

### 8. Preserve existing behavior

Run existing relevant tests after implementation:

- `npm test -- tests/unit/relevant-files.test.ts`
- `npm test -- tests/unit/variable-resolver.test.ts`
- `npm test -- tests/unit/template-renderer.test.ts`
- `npm test -- tests/unit/clipboard.test.ts`
- `npm test -- tests/cli.test.ts`

Then run the build/typecheck command from `package.json`.

## Old Paths, Bypasses, And Partial Migration Risks To Close

- `playspec phase <phaseId>` and `PlaySpecCore.renderExplicitPhasePrompt()` can render a non-effective phase. `specs` must not use or emulate this path.
- `PlaySpecCore.renderNextPrompt()` validates context refs and can fail before useful discovery. `specs` must render directly from workflow phase variables and degrade on render failure where safe.
- `outputPrompt()` writes fallback prompt files on clipboard failure. `specs` must never use that fallback behavior.
- The private selector in `use.ts` is task-specific. If extracted, existing `playspec use` PTY behavior must remain unchanged.
- Mono-spec uses stable docs (`spec.md`, `plan.md`, `result.md`, `pr.md`) while older workflows derive phase-specific files (`MASTER_SPEC_FILE`, `IMPLEMENTATION_PLAN_FILE`, `TEST_RESULT_FILE`, `PR_BODY_FILE`, etc.). Discovery must use resolved variables and workflow/template references, not a hardcoded mono-spec filename table.
- Template include paths are technical dependencies under `.playspec/templates`; they must not be shown as user docs by default.
- Existing `resolveOutputFilePath()` is write-oriented and creates directories. Read-path validation for `specs` must not create directories.
- Missing future docs are normal in early phases. They must be hidden by default and reported only with `--show-missing`.

## Risks

- Rendered prompt path extraction can overmatch prose. Mitigation: only parse backticked workspace-relative paths and resolved path-like variable values in this phase.
- Project-doc-root fallback can become noisy. Mitigation: keep it low priority and phase-filter when current phase references provide enough signal.
- Clipboard behavior is environment-dependent. Mitigation: test failure paths with existing clipboard disable env and do not require real clipboard success in tests.
- Selector extraction can regress `playspec use`. Mitigation: keep extraction optional and rerun existing PTY tests.
- Symlink and workspace escape handling can be easy to miss. Mitigation: centralize read-path normalization in discovery and add direct tests.
- Large-file handling can produce bad script behavior if mixed with stdout. Mitigation: warnings always go to stderr and stdout stays machine-readable for `--path-only` and `--print`.

## Validation Findings Resolved

- P1 resolved: discovery must use the existing `TemplateRenderer` construction and `render(definition.template, variables)` signature, with only a narrow read-only renderer helper allowed if implementation proves metadata is required.
- P2 resolved: the no-write invariant is explicitly scoped to runtime `playspec specs` behavior, separate from test fixture creation.
- P3 resolved: large-file behavior is specified for non-interactive `--print` and interactive copy/print selections; there is no non-interactive default copy mode.

Remaining active risks:

- Render-degraded warnings must be visible on stderr and covered by CLI tests.
- Hidden write paths remain prohibited: no prompt fallback files, no task state mutation, and no explicit-phase bypass.
- Read-path validation must reject workspace escapes and symlink escapes before any content read.

## Rollback Notes

- The feature is additive. Rollback can remove:
  - `src/cli/commands/specs.ts`
  - `src/core/relevant-files.ts`
  - optional `src/cli/selector.ts`
  - `specs` registration/imports in `src/cli/index.ts`
  - new tests for `specs` and relevant-file discovery
- No migration, task schema, or stored task data changes are planned.
- No generated task files or prompt fallback files should be created by the command, so rollback should not require cleanup outside code and tests.

## Completion Criteria

- `playspec specs` exists and follows the exact option behavior from the spec.
- Default interactive mode lists existing relevant files for the effective current phase and copies selected content.
- Non-interactive mode never opens a selector and requires `--path-only` or `--print`.
- Candidate discovery uses context refs, task source files, resolved variables, workflow metadata, rendered prompt text, and `projectDocRoot` files.
- Missing expected files are hidden by default and reported only with `--show-missing`.
- Invalid, escaped, symlink-escaped, binary, non-UTF-8, and large-file cases warn or fail as specified without blocking unrelated valid candidates.
- Clipboard failure does not write fallback files.
- Explicit `--task` works and does not mutate HEAD.
- `specs` is read-only for task state and workspace files.
- Mono-spec and legacy workflow file variables both work without hardcoded phase-to-filename behavior.
- Unit, CLI, and build validation pass.
