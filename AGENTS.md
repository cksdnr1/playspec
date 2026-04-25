# AGENTS.md

This file guides AI coding agents working in this repository.

## Project

PlaySpec is a TypeScript CLI/MCP workflow engine for managing LLM development tasks.

## Golden Rules

- Do not implement future phases unless explicitly requested.
- MCP is implemented in `src/mcp/` (Phase 4 complete). MCP context resolution must use `resolveMcpTaskId()` and must never call `ActiveTaskResolver` or read `.playspec/HEAD`.
- Migration is implemented in `src/migration/` (Phase 4.1 complete). Migration must validate all plans via `MigrationPlanSchema` before apply. No `delete_file` action type. Archive requires `--with-archive`.
- Do not add viewer before Phase 10.
- Do not couple Core logic to CLI.
- Do not rely on global HEAD inside Core.
- Human CLI may resolve HEAD, but Core must receive explicit taskId where possible.
- Do not auto-apply evolution proposals.
- Do not perform destructive git operations.
- Do not delete files outside `.playspec`.
- Do not hardcode absolute paths (e.g. `path.resolve('/some/absolute/path')`). Derive paths dynamically using `process.cwd()` or `import.meta.url`.
- Use path aliases for all cross-module imports. Never use `../../` relative paths to cross a module boundary. Use `#core/*.js`, `#storage/*.js`, `#workflow/*.js`, `#template/*.js`, `#preset/*.js`, `#utils/*.js`, `#mcp/*.js`, or `#migration/*.js`. Sibling imports within the same folder (e.g. `./utils.js`) are fine as-is.

## Phase 1 Scope

Implement only:

- project TypeScript setup
- CLI skeleton
- `.playspec init --preset default`
- TaskStore interface
- YamlTaskStore
- task folder creation
- `.playspec/HEAD`
- create/list/current/use
- workflow loading
- phase resolving
- template rendering
- variable resolving
- `playspec next`

## Out of Scope for Phase 1

- MCP
- rollback
- archive
- evidence collection
- state desync detection
- evolution
- harness mode
- markdown viewer
- SQLite
- DAG execution

## Expected Architecture
src/
cli/
core/
storage/
workflow/
template/
preset/
utils/


## Implementation Style

- Use zod for config/task/workflow schema validation.
- Use yaml package for YAML read/write.
- Use handlebars for template rendering.
- Use commander for CLI.
- Keep functions testable.
- Prefer explicit errors with recovery hints.

## Testing

Add vitest tests for:

- slug generation
- variable resolution
- phase resolution
- template rendering
- task create/use/current
