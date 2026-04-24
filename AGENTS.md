# AGENTS.md

This file guides AI coding agents working in this repository.

## Project

PlaySpec is a TypeScript CLI/MCP workflow engine for managing LLM development tasks.

## Golden Rules

- Do not implement future phases unless explicitly requested.
- Do not add MCP before Phase 4.
- Do not add viewer before Phase 10.
- Do not couple Core logic to CLI.
- Do not rely on global HEAD inside Core.
- Human CLI may resolve HEAD, but Core must receive explicit taskId where possible.
- Do not auto-apply evolution proposals.
- Do not perform destructive git operations.
- Do not delete files outside `.playspec`.
- Do not hardcode absolute paths (e.g. `path.resolve('/some/absolute/path')`). Derive paths dynamically using `process.cwd()` or `import.meta.url`.

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
