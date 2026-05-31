# PR Draft

Fixes #297

## Summary

- Assert the packed-and-installed consumer workspace has both `node_modules/.bin/playspec` and `node_modules/.bin/playspec-mcp`.
- Start MCP through the installed `playspec-mcp` shim instead of bypassing package `bin` metadata with `node dist/mcp/index.js`.
- Preserve existing installed file, preset workflow asset, and installed `playspec init --preset default` coverage.

## Changed Files

- `tests/integration/package-artifact.test.ts`
- `docs/features/issue_297_exercise_installed_playspec_mcp_bin_in_package_artifact_coverage/spec.md`
- `docs/features/issue_297_exercise_installed_playspec_mcp_bin_in_package_artifact_coverage/plan.md`
- `docs/features/issue_297_exercise_installed_playspec_mcp_bin_in_package_artifact_coverage/result.md`
- `docs/features/issue_297_exercise_installed_playspec_mcp_bin_in_package_artifact_coverage/pr.md`

## Tests Run

- `pnpm test:package-artifact`

Skipped:

- `pnpm test -- --run tests/integration/runtime-bin.test.ts` because shared runtime-bin assertions were not touched.

## PlaySpec Task

- `issue_297_exercise_installed_playspec_mcp_bin_in_package_artifact_coverage`

## Risk Notes

- Package-manager bin shims can differ by platform; this keeps the same explicit `node_modules/.bin/<command>` path style already used by the installed `playspec` assertion.
- MCP startup timeout and empty stdin handling are unchanged.

## Reusable Agent Guidance

- No reusable agent guidance changes are needed; this was a narrow package artifact test coverage update.
