# GitHub Issue #244 Package Artifact Coverage Result

## Files Changed

- `package.json`
- `tests/integration/package-artifact.test.ts`
- `docs/features/github_issue_244_package_artifact_coverage/spec.md`
- `docs/features/github_issue_244_package_artifact_coverage/plan.md`
- `docs/features/github_issue_244_package_artifact_coverage/result.md`

## Behavior Implemented

- Added `prepack` so package creation runs the existing build and refreshes `dist`.
- Added an explicit package `files` allowlist for `dist` and `README.md`.
- Added `test:package-artifact` as a focused command for the artifact smoke test.
- Added a package artifact integration test that:
  - packs the repository into a temporary tarball;
  - installs the tarball into a temporary consumer workspace;
  - asserts compiled CLI/MCP bins, representative runtime alias targets, and bundled `mono-spec` workflow assets exist in the installed package;
  - runs the installed `playspec` bin with `init --preset default`;
  - verifies `.playspec/workflows/mono-spec/workflow.yaml` is created from bundled workflow assets;
  - starts the installed MCP entrypoint without package import resolution errors.

## Refactor Notes

- Replaced repeated installed-artifact file assertions in `tests/integration/package-artifact.test.ts` with a single expected file list and loop.
- Intentionally skipped broader cleanup outside the package artifact test and metadata touched for this issue.

## Verification

- `pnpm test -- tests/integration/package-artifact.test.ts` - passed.
- `pnpm test -- tests/integration/runtime-bin.test.ts` - passed.
- `pnpm build` - passed.
- `pnpm test -- tests/integration/package-artifact.test.ts` - passed again after the local assertion cleanup.

## Remaining Risks

- The package artifact test runs `pnpm pack`, so it is intentionally slower than source-only tests.
- The smoke test installs the local tarball with `pnpm install --prefer-offline`; it prefers the local pnpm cache but can resolve missing registry metadata in a fresh environment.

## PR Preparation

- PR body source: `docs/features/github_issue_244_package_artifact_coverage/pr.md`.
- Reusable agent guidance: no new guidance needed.
- PR link: https://github.com/cksdnr1/playspec/pull/246.
