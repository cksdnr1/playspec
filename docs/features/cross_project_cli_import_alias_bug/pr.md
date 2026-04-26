# Fix runtime alias resolution for packaged CLI bins

## Summary

This PR makes PlaySpec's packaged Node entrypoints resolve the internal `#...` aliases that are already used by source and emitted `dist` files.

- Adds package-owned Node ESM `"imports"` mappings in `package.json` for the existing alias families from `tsconfig.json`.
- Maps those aliases to `./dist/...` because the published/linkable `playspec` and `playspec-mcp` bins execute compiled files.
- Adds build-backed runtime smoke coverage for the compiled CLI and MCP entrypoints.

## Reviewer Notes

The user-visible bug happened before command dispatch: `dist/cli/index.js` imported `#core/errors.js`, but `package.json` did not define any runtime package-import mappings. TypeScript paths and Vitest aliases covered source/dev execution, but Node runtime ESM did not read those settings when a linked or installed bin was invoked from another project.

The corrected CLI path is:

`playspec` bin -> `dist/cli/index.js` -> package `"imports"` resolves `#core/*.js` to `dist/core/*.js` -> commander dispatches `init` -> `runInit()` uses the external `process.cwd()` -> `PresetManager.initWorkspace()` writes `.playspec/HEAD` in that external workspace -> `playspec init --preset default` succeeds for the caller.

The MCP bin uses the same package-import mechanism, so the runtime smoke also starts `dist/mcp/index.js` with closed stdin and asserts it does not fail on package import resolution.

No reset/clear behavior is part of this bug fix; the relevant state update is external workspace initialization under `.playspec`.

## Files Changed

- `package.json`
  - Adds `"imports"` mappings for `#core`, `#storage`, `#workflow`, `#template`, `#preset`, `#utils`, `#mcp`, and `#migration`.
- `tests/integration/runtime-bin.test.ts`
  - Runs `pnpm build` before runtime-bin assertions.
  - Verifies `package.json` import aliases mirror `tsconfig.json` paths and cover alias families found in `src` and fresh `dist`.
  - Verifies compiled CLI help succeeds from an external temp workspace.
  - Verifies compiled CLI `init --preset default` creates `.playspec/HEAD` in the external temp workspace.
  - Verifies compiled MCP startup exits without alias-resolution errors.

## Validation

- `pnpm build`
- `pnpm vitest run tests/integration/runtime-bin.test.ts`
- `pnpm vitest run tests/cli.test.ts tests/integration/mcp-server.test.ts`

## Risks and Limitations

- `docs/features/cross_project_cli_import_alias_bug/plan.md` was requested as source material but is not present in the repository. The PR summary is based on the current diff, `spec.md`, and `result.md`.
- This PR does not add a `pnpm pack` install smoke. The spec tracks package artifact completeness as a useful follow-up, not a required part of the immediate runtime-alias fix.
- Runtime-bin coverage is build-backed and intentionally narrower than full package-install validation.

## Reusable Agent Guidance

No new reusable agent guidance should be documented for this fix. The existing project guidance already requires cross-module alias imports; the missing piece was package runtime metadata and regression coverage, which are captured in this feature's spec/result docs rather than a broadly reusable agent rule.
