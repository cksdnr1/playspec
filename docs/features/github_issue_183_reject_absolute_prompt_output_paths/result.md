# Implementation Result

## Files Changed

- `src/cli/cli-utils.ts`
- `tests/cli.test.ts`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/spec.md`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/plan.md`
- `docs/features/github_issue_183_reject_absolute_prompt_output_paths/result.md`

## Behavior Implemented

- `resolveOutputFilePath()` now validates all `--out` paths against the real workspace boundary.
- Absolute output paths outside the workspace are rejected before prompt or metadata sidecar writes.
- Absolute output paths inside the workspace remain supported.
- Returned output paths are canonicalized through the nearest existing real path, so metadata sidecars store workspace-relative `promptArtifactPath` values even on systems where temp paths have symlink aliases such as `/var` and `/private/var`.
- Parent directory realpath validation now applies to absolute and relative paths, preserving symlink escape rejection.
- Error guidance now tells users to choose an output path inside the workspace or use a workspace-relative path.

## Verification Performed

- `pnpm test -- tests/cli.test.ts -t 'prompt --out writes absolute paths inside the workspace'`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## Tests Changed

- Added `next --out` regression coverage for absolute paths outside the workspace.
- Added `prompt --out` regression coverage for absolute paths outside the workspace.
- Added `prompt --out` coverage for an absolute path inside the workspace and verified the metadata sidecar stores a non-escaping workspace-relative `promptArtifactPath`.

## Test Results

- Focused targeted test: passed.
- CLI test file: 184 tests passed.
- Build: passed.
- Full test suite: 24 test files passed, 510 tests passed.

## Failures Encountered

- Initial CLI test runs exposed macOS temp-path aliasing between `/var` and `/private/var`.
- The resolver was adjusted to canonicalize accepted paths through the nearest existing realpath prefix before writing metadata.

## Remaining Test Gaps

- None for the issue acceptance criteria.

## Refactor Review

- Ran `git diff --check`; no whitespace errors were reported.
- No additional refactor was applied. The implementation is already localized to the shared resolver and focused CLI tests.
- Skipped broader cleanup of prompt/next output code because it would change deprecated alias behavior outside the issue scope.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/184
- Reusable agent guidance: no update needed.

## Remaining Risks

- Compatibility: callers that intentionally wrote prompt artifacts outside the workspace through absolute paths now receive a validation error.
- The resolver canonicalizes accepted paths to the real workspace path before writing. This keeps metadata consistent with the real workspace root, but output status messages may display canonicalized relative paths when symlink aliases are involved.
