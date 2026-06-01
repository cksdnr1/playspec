# Issue #297 Implementation Plan

## Ordered Steps

1. Update `tests/integration/package-artifact.test.ts` bin path setup.
   - Keep `installedPackageRoot` and installed file assertions unchanged.
   - Keep `binPath` for `node_modules/.bin/playspec`.
   - Change `mcpBinPath` to `path.join(consumerWorkspace.dir, 'node_modules', '.bin', 'playspec-mcp')`.

2. Assert installed command shims exist.
   - Add `await expectFileExists(binPath);`.
   - Add `await expectFileExists(mcpBinPath);`.
   - This directly covers the package-manager-created shims after installing the packed tarball.

3. Start MCP through the installed shim.
   - Replace `execa('node', [mcpBinPath], ...)` with `execa(mcpBinPath, [], ...)`.
   - Preserve `cwd: consumerWorkspace.dir`, `input: ''`, `reject: false`, and `timeout: 5000`.
   - Preserve assertions for exit code `0`, no `ERR_PACKAGE_IMPORT_NOT_DEFINED`, and no `Package import specifier`.

4. Validate with the focused package artifact smoke test.
   - Run `pnpm test:package-artifact`.
   - Do not run `tests/integration/runtime-bin.test.ts` unless the implementation expands into shared runtime-bin assertions.

## Files To Edit

- `tests/integration/package-artifact.test.ts`

## Tests To Add Or Update

- Update the existing `packs installable compiled bins and preset workflow assets` test to assert and invoke `node_modules/.bin/playspec-mcp`.
- No new test file is needed because the existing package artifact integration test is the acceptance surface.

## Old Paths, Bypasses, And Partial Migration Risks

- Old MCP execution path: `node node_modules/playspec/dist/mcp/index.js`.
- Required replacement execution path: `node_modules/.bin/playspec-mcp`.
- Keep the direct installed file assertion for `dist/mcp/index.js`; it proves the artifact still contains the compiled target referenced by `package.json#bin`.
- Do not leave an MCP startup assertion that only exercises the direct file path.

## Risks

- Package-manager shims differ by platform. Mitigation: use the explicit `.bin` path style already used for `playspec` instead of relying on shell lookup.
- MCP process startup is timeout-sensitive. Mitigation: preserve the existing timeout and empty stdin handling.

## Rollback Notes

- Revert the small edits in `tests/integration/package-artifact.test.ts` if the package artifact shim behavior needs to be restored for investigation.
- No production code, schema, migration, or persisted state changes are involved.

## Completion Criteria

- `node_modules/.bin/playspec-mcp` existence is asserted after tarball install.
- MCP is started through `node_modules/.bin/playspec-mcp`.
- Existing installed preset workflow asset assertions remain intact.
- Existing installed `playspec` command assertion remains intact.
- `pnpm test:package-artifact` passes.
