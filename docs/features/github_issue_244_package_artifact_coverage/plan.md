# GitHub Issue #244 Package Artifact Coverage Plan

## Ordered Implementation Steps

1. Update `package.json`.
   - Add a `prepack` script that runs `pnpm build`, so `pnpm pack` and publishing build the compiled artifact first.
   - Add a focused script, `test:package-artifact`, that runs the new integration test by path.
   - Add `files: ["dist", "README.md"]` so the package artifact explicitly includes runtime output and documentation while keeping source/test directories out of the tarball.

2. Add `tests/integration/package-artifact.test.ts`.
   - Use `createTempWorkspace()` for an isolated pack destination and a separate consumer workspace.
   - Run `pnpm pack --pack-destination <packDir>` from the repo root; this must exercise `prepack`.
   - Initialize the consumer workspace with `pnpm init`.
   - Install the generated local tarball into the consumer workspace with `pnpm add <tarball>`.
   - Assert installed package files exist under `node_modules/playspec`:
     - `dist/cli/index.js`;
     - `dist/mcp/index.js`;
     - `dist/workflow/workflow-registry.js`;
     - `dist/preset/assets/workflows/mono-spec/workflow.yaml`;
     - one copied built-in template such as `dist/preset/assets/workflows/mono-spec/templates/tech_spec_draft.md`.
   - Run the installed bin through `node_modules/.bin/playspec init --preset default`.
   - Assert the consumer workspace has `.playspec/workflows/mono-spec/workflow.yaml`.

3. Keep `tests/integration/runtime-bin.test.ts` unchanged unless a test collision appears.
   - It should remain direct local-build runtime coverage.
   - The package-artifact test should be separate and prove the tarball/install boundary.

4. Update `docs/features/github_issue_244_package_artifact_coverage/result.md` during implementation.
   - Record changed files, behavior implemented, validation commands, and risks.

## Active Path To Verify

`pnpm pack` -> `prepack` -> `pnpm build` -> tarball contains `dist/**` -> temp consumer installs tarball -> installed `playspec` bin runs -> `PresetManager.initWorkspace()` reads built-in workflows from installed `dist/preset/assets/workflows` -> `.playspec/workflows/mono-spec/workflow.yaml` exists in consumer workspace.

## Old Paths, Bypasses, And Partial Migration Risks

- Existing runtime-bin tests execute repository-local `dist` directly and must not be treated as package artifact coverage.
- `pnpm build` copies assets to local `dist`, but missing package `files` metadata could still omit them from a tarball.
- The package artifact test must inspect installed package contents, not only command output, so missing copied assets fail before or during init.
- Avoid global install and network-dependent validation.

## Files To Edit

- `package.json`
- `tests/integration/package-artifact.test.ts`
- `docs/features/github_issue_244_package_artifact_coverage/result.md`

## Tests To Run

- `pnpm test -- tests/integration/package-artifact.test.ts`
- `pnpm test -- tests/integration/runtime-bin.test.ts`
- `pnpm build`
- If time allows, `pnpm test`

## Risks

- `prepack` adds build cost to `pnpm pack`; this is acceptable for a publishing guard but should not run broader tests.
- `pnpm add <tarball>` can create temporary lockfiles in the consumer workspace; those stay outside the repo and are cleaned up.
- If `pnpm pack --pack-destination` output format changes, the test should locate the `.tgz` by reading the destination directory instead of parsing stdout only.

## Rollback Notes

Revert `package.json` metadata changes and remove the new package artifact test if the guard proves too slow or incompatible with local package-manager behavior.

## Completion Criteria

- `pnpm pack` builds the package before tarball creation.
- Tarball installation test fails if `dist` or `dist/preset/assets/workflows/mono-spec` is missing.
- Installed `playspec init --preset default` creates `.playspec/workflows/mono-spec/workflow.yaml`.
- Existing runtime-bin integration test still passes independently.
