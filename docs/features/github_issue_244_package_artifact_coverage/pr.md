Fixes #244

## Summary

- Adds a package artifact guard that packs and installs the generated tarball in a temporary consumer workspace.
- Verifies installed compiled CLI/MCP bins, representative runtime alias targets, and bundled `mono-spec` workflow assets.
- Adds package metadata so pack/publish builds `dist` first and the artifact explicitly includes runtime output.

## Why this PR

The package bins and runtime import aliases point at `dist`, and `playspec init --preset default` loads built-in workflows from `dist/preset/assets/workflows`. Existing runtime-bin tests execute local `dist` directly, but they do not prove the npm tarball or installed package contains the compiled files and copied workflow templates that consumers actually use.

## Problem

A release could pass source tests and local compiled-bin tests while publishing or installing an artifact that omits `dist/cli/index.js`, `dist/mcp/index.js`, runtime import targets, or bundled preset workflow assets.

## How it was fixed

- `package.json` now defines `prepack` as `pnpm build`, so `pnpm pack` refreshes compiled output and copied preset assets before creating the artifact.
- `package.json` now includes a `files` allowlist for `dist` and `README.md`, making runtime package contents explicit.
- `tests/integration/package-artifact.test.ts` runs `pnpm pack`, installs the generated tarball into a temp consumer project, checks installed `dist` files and `mono-spec` workflow templates, runs installed `playspec init --preset default`, and starts the installed MCP entrypoint without package import resolution errors.
- `tests/integration/runtime-bin.test.ts` remains unchanged as direct local-build runtime coverage.

## Changed files

- `package.json`
- `tests/integration/package-artifact.test.ts`
- `docs/features/github_issue_244_package_artifact_coverage/spec.md`
- `docs/features/github_issue_244_package_artifact_coverage/plan.md`
- `docs/features/github_issue_244_package_artifact_coverage/result.md`
- `docs/features/github_issue_244_package_artifact_coverage/pr.md`

## Tests run

- `pnpm test -- tests/integration/package-artifact.test.ts` - passed.
- `pnpm test -- tests/integration/runtime-bin.test.ts` - passed.
- `pnpm build` - passed.
- `pnpm test -- tests/integration/package-artifact.test.ts` - passed again after the local assertion cleanup.

## PlaySpec task id

`github_issue_244_package_artifact_coverage`

## Risk notes

- The package artifact test is slower than source-only tests because it intentionally runs `pnpm pack` and installs the local tarball.
- The temp consumer install uses `pnpm install --prefer-offline`; it prefers cached packages but can resolve missing registry metadata in a fresh environment.

## Reusable agent guidance

No new reusable agent guidance is needed. The existing repository rules and PlaySpec workflow were sufficient.
