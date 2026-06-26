# Implementation Plan: Issue 307

## Ordered Steps

1. Add compact-mode prompt cleanup in `src/core/playspec-core.ts`.
   - Before appending `## Compact Context Summary`, remove rendered `CONTEXT_FILES` and `CONTEXT_REFS_DETAIL` variable blocks from the base prompt.
   - Match only the current template shape:
     - `- CONTEXT_FILES:` followed by backtick path bullet lines or `(none)`.
     - `- CONTEXT_REFS_DETAIL:` followed by backtick path/detail bullet lines or `(none)`.
   - Leave unrelated prompt text untouched.

2. Keep one enriched compact context list.
   - Reuse the existing compact summary row format:
     - ``- `path` (role: role, source: source): snippet``
   - Continue using `summarizeContextContent()` for first-line/first-paragraph snippet extraction.
   - Preserve `path`, `role`, `source`, and snippet in the single row per context ref.

3. Add non-compact context body line wrapping.
   - Add a small helper for context body formatting inside fenced context sections.
   - Split physical lines longer than a fixed maximum into multiple physical lines.
   - Preserve content order and avoid changing context-file headings, role, source, and fences.

4. Add integration coverage in `tests/integration/init-create-next.test.ts`.
   - Create a task with multiple context refs and source files with recognizable first-line snippets.
   - Assert compact output contains each enriched context row exactly once.
   - Assert compact output no longer contains the `- CONTEXT_FILES:` or `- CONTEXT_REFS_DETAIL:` blocks.
   - Add a full-mode long-line context file and assert rendered output has multiple lines within the context section.

5. Add MCP phase prompt regression coverage in `tests/integration/mcp-server.test.ts`.
   - Exercise `playspec_render_phase_prompt` with `contextMode: 'compact'`.
   - Assert the prompt returned by MCP has the same deduped compact context behavior.
   - This verifies the existing MCP delegation path without adding MCP-specific formatting.

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: Workflow templates render `CONTEXT_FILES` and `CONTEXT_REFS_DETAIL` before core appends compact context.
- Bypass path: Any workflow template can include those variables; cleanup must operate on the rendered prompt, not only mono-spec source templates.
- Partial migration risk: Updating only mono-spec templates would leave MCP/CLI and other workflows inconsistent. The implementation must live in core prompt rendering.

## Rollback Notes

- Revert the helpers and tests in the three edited files.
- No task storage, workflow schema, MCP API, or migration data changes are introduced.

## Completion Criteria

- Compact rendered prompts list each context ref exactly once with path, role, source, and snippet.
- Full rendered prompts split very long context-file physical lines so line-based chunking can work.
- Existing `CONTEXT_FILES` and `CONTEXT_REFS_DETAIL` variable resolution remains compatible for non-compact behavior and direct variable tests.
- Focused integration tests pass.
- Full repository validation passes before commit.
