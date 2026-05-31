# Issue #297 Implementation Result

## Files Changed

- `tests/integration/package-artifact.test.ts`
- `docs/features/issue_297_exercise_installed_playspec_mcp_bin_in_package_artifact_coverage/spec.md`
- `docs/features/issue_297_exercise_installed_playspec_mcp_bin_in_package_artifact_coverage/plan.md`
- `docs/features/issue_297_exercise_installed_playspec_mcp_bin_in_package_artifact_coverage/result.md`

## Behavior Implemented

- The package artifact smoke test now asserts the installed `node_modules/.bin/playspec` shim exists.
- The package artifact smoke test now asserts the installed `node_modules/.bin/playspec-mcp` shim exists.
- MCP startup in the packed-and-installed consumer workspace now runs through `node_modules/.bin/playspec-mcp` instead of `node node_modules/playspec/dist/mcp/index.js`.
- Existing installed file assertions, preset workflow asset assertions, `playspec init --preset default` execution, MCP timeout/stdin behavior, and package import error checks remain intact.

## Verification Performed

- `pnpm test:package-artifact` passed.
- `pnpm test -- --run tests/integration/runtime-bin.test.ts` was skipped because no shared runtime-bin assertions or runtime-bin source files were changed.

## Safe Refactor Review

- Reviewed the implementation diff.
- No refactor was applied because the change is already limited to the package artifact test assertion block.
- Scope intentionally stayed out of runtime-bin tests and production MCP startup code.

## PR Prep

- Draft PR notes were written in `pr.md`.
- Reusable agent guidance does not need to be documented for this narrow test coverage change.
- Branch pushed: `agent/issue-297-playspec-mcp-bin`.
- Draft PR created: https://github.com/cksdnr1/playspec/pull/298.
- Issue label `agent-pr-created` was added.

## Remaining Risks

- Package-manager shim behavior can vary by platform, but the test uses the same explicit `node_modules/.bin/<command>` path style already used for the installed `playspec` command.
