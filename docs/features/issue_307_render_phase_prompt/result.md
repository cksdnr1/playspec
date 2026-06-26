# Implementation Result: Issue 307

## Files Changed

- `src/core/playspec-core.ts`
- `tests/integration/init-create-next.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_307_render_phase_prompt/spec.md`
- `docs/features/issue_307_render_phase_prompt/plan.md`
- `docs/features/issue_307_render_phase_prompt/result.md`

## Behavior Implemented

- Compact context rendering now removes the rendered `CONTEXT_FILES` and `CONTEXT_REFS_DETAIL` variable blocks before appending `## Compact Context Summary`.
- The compact summary remains the single enriched context-list section, preserving each row's path, role, source, and first-paragraph snippet.
- Non-compact context body rendering now wraps very long physical lines into bounded prompt lines while preserving content order inside the fenced context section.
- MCP `playspec_render_phase_prompt` receives the compact dedupe behavior through the existing core renderer path.

## Verification Performed

- `pnpm vitest run tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts`
  - First run exposed a compatibility failure around `SOURCE_PROBLEM_FILE`; implementation was narrowed to the duplicated context-list blocks.
  - Final run passed: 2 files, 140 tests.
- `pnpm test`
  - Passed: 33 files, 697 tests.
- `pnpm build`
  - Passed.
- Post-rebase check: `pnpm vitest run tests/integration/init-create-next.test.ts tests/integration/mcp-server.test.ts && pnpm build`
  - Passed: focused tests 2 files, 145 tests; build passed.

## Tests Changed

- `tests/integration/init-create-next.test.ts`
  - Added compact dedupe coverage for mono-spec prompts with multiple context refs.
  - Added full-mode coverage for wrapping a long single-line context file into multiple prompt lines.
- `tests/integration/mcp-server.test.ts`
  - Added `playspec_render_phase_prompt` compact-mode coverage to verify MCP receives the deduped compact prompt through core rendering.

## Test Gaps

- No separate unit tests were added for private helpers; behavior is covered through public core/MCP prompt rendering entry points.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No behavior-preserving cleanup was applied.
- Intentionally skipped extracting shared test helpers because the occurrence-count helper is only used locally in two integration files and a shared utility would broaden the change.

## Remaining Risks

- Compact cleanup is intentionally text-shape-based because templates render variable blocks into markdown before context-mode handling. The helper only targets the current generated context-list block shape.
- Long-line wrapping changes physical line breaks inside context fences, but preserves character order when lines are joined.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/310
