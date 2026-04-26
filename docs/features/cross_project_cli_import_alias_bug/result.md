# cross_project_cli_import_alias_bug Result

## Files Changed

- `package.json`
  - Added Node ESM `"imports"` mappings for the internal alias families already defined in `tsconfig.json`.
  - Mapped runtime aliases to `./dist/...` because published and linked bins execute compiled files.
- `tests/integration/runtime-bin.test.ts`
  - Added build-backed runtime smoke coverage for the compiled CLI and MCP bins.
  - Added alias coverage validation comparing `package.json` runtime imports with `tsconfig.json` paths and checking aliases found in `src` and fresh `dist`.

## Behavior Implemented

- `node dist/cli/index.js --help` can resolve internal `#...` imports through package-owned runtime metadata.
- `node dist/cli/index.js init --preset default` works from an external temporary project directory and creates `.playspec/HEAD` in that external workspace.
- `node dist/mcp/index.js` starts and exits with closed stdin without failing on package import alias resolution.
- Source/dev execution remains covered separately through existing `tsx --tsconfig` CLI and MCP tests.

## Verification Performed

- `pnpm build`
  - Passes.
  - Confirms the package compiles and emits the compiled CLI and MCP bins used by runtime smoke coverage.
- `pnpm vitest run tests/integration/runtime-bin.test.ts`
  - Passes 4 tests.
  - The test runs `pnpm build` first, then validates compiled `dist` entrypoints.
- `pnpm vitest run tests/cli.test.ts tests/integration/mcp-server.test.ts`
  - Passes 67 tests.
  - Confirms existing source/dev CLI and MCP paths still work after adding `package.json` `"imports"`.

## PR Preparation

- Compared the work against fresh `origin/master`.
- Wrote reviewer-facing PR notes to `docs/features/cross_project_cli_import_alias_bug/pr.md`.
- PR summary reflects the active runtime path:
  `playspec` bin -> compiled CLI entrypoint -> package `"imports"` alias resolution -> commander init action -> `PresetManager` external workspace write -> `.playspec/HEAD` user-visible initialization.
- MCP runtime coverage is included because `playspec-mcp` is an exposed compiled bin using the same alias scheme.
- No reset/clear behavior is part of this bug fix; the relevant state/data update is external workspace initialization.
- Reusable agent guidance decision: no new reusable guidance should be documented. Existing `AGENTS.md` import-alias guidance is sufficient; this feature documents the runtime-metadata lesson in `spec.md`, `result.md`, and `pr.md`.
- PR link: pending creation.

## Remaining Risks

- `docs/features/cross_project_cli_import_alias_bug/plan.md` was requested by the task but is not present in the repository. The implementation followed the file-by-file plan embedded in `spec.md`.
- This change does not add a `pnpm pack` installation smoke. The spec marks package artifact completeness as a follow-up rather than required for this immediate fix.
