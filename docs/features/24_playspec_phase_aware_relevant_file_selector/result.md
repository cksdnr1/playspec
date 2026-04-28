# Implementation Result: 24-playspec_phase_aware_relevant_file_selector

## Files Changed

- `src/core/relevant-files.ts` - added read-only relevant-file discovery from context refs, task source files, resolved variables, workflow metadata, rendered prompt backticked paths, and existing project docs.
- `src/cli/commands/specs.ts` - added `playspec specs` command behavior for path output, print output, interactive selection, clipboard copy, missing-file reporting, large-file handling, and text validation.
- `src/cli/index.ts` - registered `specs` with `--task`, `--print`, `--path-only`, `--no-copy`, `--show-missing`, and `--force-large`.
- `tests/unit/relevant-files.test.ts` - added focused discovery coverage.
- `tests/cli.test.ts` - added CLI coverage for path-only, explicit task selection, missing-file stderr, non-interactive failure, print output, binary/large-file skipping, and interactive `--no-copy`.

## Behavior Implemented

- `playspec specs` resolves the task via HEAD by default or `--task <id>`, requires implicit HEAD tasks to be active, and resolves the effective current workflow phase without mutating task state.
- Discovery is dynamic and does not hardcode mono-spec filenames; it uses the existing variable resolver and template renderer directly, avoiding prompt snapshot/fallback helpers.
- Existing files are shown by default. Missing expected files are reported only with `--show-missing` and go to stderr.
- `--path-only` prints existing relevant paths to stdout, one per line.
- Non-interactive `--print` prints all existing UTF-8 text candidates with `===== <path> =====` separators.
- Interactive mode opens an arrow-key selector. Default selection copies selected file content; `--no-copy` reports the path; `--print` prints selected content.
- Invalid, escaped, absolute, URL, shell-looking, placeholder, template dependency, and symlink-escaped paths warn and are skipped.
- Binary or non-UTF-8 files remain visible in `--path-only` but are skipped or rejected for content output.
- Files larger than 1 MiB require interactive confirmation unless `--force-large`; non-interactive print skips them unless forced.

## Verification Performed

- `npm test -- tests/unit/relevant-files.test.ts` - passed.
- `npm test -- tests/cli.test.ts -t specs` - passed.
- `npm test -- tests/unit/relevant-files.test.ts tests/cli.test.ts` - passed locally; the full CLI file is slow in this repository and completed in about 2-3 minutes.
- `npm test -- tests/unit/variable-resolver.test.ts` - passed.
- `npm test -- tests/unit/template-renderer.test.ts` - passed.
- `npm test -- tests/unit/clipboard.test.ts` - passed.
- `npm run build` - passed.
- Post-implementation spec verifier and refactor guard were run. The refactor guard flagged only an unrelated pre-existing untracked `docs/features/20_add_safe_phase_recovery/` path and an extra discovery result field, which was removed.

## PR Preparation

- PR file written to `docs/features/24_playspec_phase_aware_relevant_file_selector/pr.md`.
- Branch pushed as `24-playspec_phase_aware_relevant_file_selector` against `origin/master`.
- PR created: https://github.com/cksdnr1/playspec/pull/26

## Agent Guidance Recommendation

No reusable agent guidance needs to be documented. The implementation is additive and self-contained. The key judgment calls (render-only via `TemplateRenderer` not `PlaySpecCore.renderNextPrompt()`, degraded discovery on render failure, no fallback file writes on clipboard failure) are explained inline in `plan.md` and `spec.md` and do not represent new patterns that need separate documentation for future agents.

## Remaining Risks

- Project doc root fallback currently includes all existing files under `task.paths.projectDocRoot` as a low-priority supplement rather than applying additional phase filtering.
- CLI tests do not cover every edge branch directly, such as clipboard failure and interactive large-file confirmation, but core filtering and command output paths are covered.
