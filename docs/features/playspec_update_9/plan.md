# PlaySpec Update 9: Implementation Plan

## Constraints

- Implement Phase 9 only.
- Keep Core independent from CLI.
- Use path aliases for cross-module imports.
- Treat viewer behavior as read-only except generated cache files.

## Steps

1. Add a small viewer module under `src/viewer/`.
   - Create `src/viewer/markdown-viewer.ts`.
   - Resolve explicit markdown files safely within the workspace using normalized path checks and realpath symlink checks.
   - Resolve task artifact requests from `YamlTaskStore`, `WorkflowLoader`, `PhaseResolver`, and `VariableResolver`.
   - Support workflow artifact paths for `spec`, `plan`, `result`, and `pr`.
   - Support task directories for `source`, `prompt`, `evidence`, `snapshot`, and `review`, selecting the newest readable markdown/text artifact where appropriate.
   - Render markdown to standalone HTML with `marked`.
   - Write generated HTML under `.playspec/viewer/cache/` or return HTML for stdout.
   - Clear only the generated cache directory.

2. Add CLI command `playspec view`.
   - Create `src/cli/commands/view.ts`.
   - Register the command in `src/cli/index.ts`.
   - Options: `--task <id>`, `--artifact <type>`, `--open`, `--stdout`, `--clear-cache`.
   - Require either an explicit path, a task/artifact pair, or `--clear-cache`.
   - Print the generated preview path unless `--stdout` is used.
   - Use the existing `open` dependency only when `--open` is passed.

3. Add import alias coverage.
   - Add `#viewer/*.js` to `package.json` imports and `tsconfig.json` paths.

4. Add tests.
   - Extend `tests/cli.test.ts` with CLI integration coverage for explicit file render, task artifact render, path escape rejection, state non-mutation, and cache clear.
   - Add any narrow unit tests only if integration coverage cannot observe the behavior clearly.

5. Validate.
   - Run `pnpm build`.
   - Run focused viewer tests.
   - Run the full test suite if focused tests and build pass.

## Files To Edit

- `src/viewer/markdown-viewer.ts`
- `src/cli/commands/view.ts`
- `src/cli/index.ts`
- `package.json`
- `tsconfig.json`
- `tests/cli.test.ts`
- `docs/features/playspec_update_9/result.md`
- `docs/features/playspec_update_9/pr.md`

## End-To-End Chain

1. CLI parses `playspec view`.
2. Viewer resolves the explicit path or task artifact without writing task state.
3. Viewer reads a workspace-contained markdown/text source.
4. Viewer renders local HTML.
5. Viewer either writes cache output, prints HTML, opens the generated file when requested, or clears only cache output.
6. Tests compare task state before and after viewer commands.

## Risks

- The viewer writes cache output, so tests must distinguish allowed generated files from task-state mutation.
- Task artifact resolution should reuse workflow artifact paths instead of hardcoded mono-spec docs wherever possible.
- Opening a browser is environment-sensitive; tests should use non-open output paths and not require a GUI.

## Rollback Notes

All implementation changes are additive. Reverting the new viewer module, CLI registration, alias entries, tests, and generated docs removes the feature without touching existing task/workflow behavior.

## Completion Criteria

- `playspec view <markdown-path>` generates readable HTML.
- `playspec view --task <id> --artifact spec` resolves a task artifact and generates HTML.
- Workspace escape attempts fail with a clear error.
- `--clear-cache` removes only `.playspec/viewer/cache`.
- Viewer commands do not mutate `task.yaml`.
- Build and focused tests pass; full tests are run unless blocked.
