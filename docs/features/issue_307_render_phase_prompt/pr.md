Fixes #307

## Summary

- Dedupes compact prompt context output by removing the rendered `CONTEXT_FILES` and `CONTEXT_REFS_DETAIL` blocks before appending the enriched compact context summary.
- Preserves each compact context row's path, role, source, and snippet in one place.
- Wraps very long context-file physical lines in non-compact prompt sections so full-mode output is line-chunkable.
- Adds core and MCP regression coverage for the prompt-rendering path.

## Why this PR

`playspec_render_phase_prompt` could produce overly heavy prompts: compact mode repeated the same context paths through template variables and the compact summary, and full mode could include huge single-line context bodies. That made prompts harder to read, harder to chunk, and more likely to exceed downstream limits.

## Problem

- Compact prompt rendering appended `## Compact Context Summary` after workflow templates had already rendered `CONTEXT_FILES` and `CONTEXT_REFS_DETAIL`.
- Non-compact context rendering placed context file contents into fenced blocks without breaking very long physical lines.
- MCP phase prompt rendering inherited both behaviors through the core renderer.

## How it was fixed

- `src/core/playspec-core.ts`
  - Added compact cleanup for rendered `CONTEXT_FILES` / `CONTEXT_REFS_DETAIL` blocks.
  - Kept the existing compact summary as the single enriched list with path, role, source, and snippet.
  - Added long-line wrapping for context body content before strict/full fenced sections are appended.
- `tests/integration/init-create-next.test.ts`
  - Added compact dedupe coverage for mono-spec prompts with multiple context refs.
  - Added full-mode long-line wrapping coverage.
- `tests/integration/mcp-server.test.ts`
  - Added direct `playspec_render_phase_prompt` compact-mode regression coverage.

## Changed files

- `src/core/playspec-core.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_307_render_phase_prompt/spec.md`
- `docs/features/issue_307_render_phase_prompt/plan.md`
- `docs/features/issue_307_render_phase_prompt/result.md`
- `docs/features/issue_307_render_phase_prompt/pr.md`

## Validation

- `pnpm vitest run tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
  - First run failed on an existing `SOURCE_PROBLEM_FILE` compatibility expectation; implementation was narrowed to remove only duplicated context-list blocks.
  - Final run passed: 2 files, 140 tests.
- `pnpm test`
  - Passed: 33 files, 697 tests.
- `pnpm build`
  - Passed.
- Post-rebase check: `pnpm vitest run tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts && pnpm build`
  - Passed: focused tests 2 files, 145 tests; build passed.
- Skipped: none.

## PlaySpec task id

`issue_307_render_phase_prompt`

## Risks / follow-ups

- Compact cleanup is intentionally based on the rendered markdown shape of the generated context variable blocks.
- Long-line wrapping changes physical line breaks inside context fences, but preserves character order when joined.
- Reusable agent guidance documented: no. This was a localized prompt-rendering fix and did not reveal a repo-wide agent instruction gap.
