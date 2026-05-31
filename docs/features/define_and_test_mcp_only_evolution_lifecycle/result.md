# Define And Test MCP-Only Evolution Lifecycle Result

## Files Changed

- `docs/mcp-evolution-lifecycle.md`
- `README.md`
- `tests/integration/mcp-server.test.ts`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/spec.md`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/plan.md`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/result.md`

## Behavior Implemented

- Documented the supported MCP-only evolution sequence after workflow completion.
- Updated the README MCP tool list to include `playspec_append_evolution_thread_evidence`.
- Linked README MCP guidance to the lifecycle document.
- Added MCP integration coverage for:
  - completing a phase with `withEvolutionContext`;
  - generating a proposal from explicit evidence and session context;
  - appending evidence and fetching/listing the updated proposal;
  - refusing duplicate active proposal targets;
  - explicitly refining an existing proposal with `proposalId`;
  - appending feedback-thread evidence and fetching the updated proposal;
  - diffing executable proposals;
  - rejecting apply without `approved: true`;
  - applying with explicit approval and reporting `applied` status.

## Verification Performed

- `pnpm exec vitest run tests/integration/mcp-server.test.ts`
  - Initial run failed on an incorrect expected evolution context snapshot path.
  - Rerun passed: 71 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 32 test files, 672 tests.

## Remaining Risks

- No source behavior changes were made. The lifecycle relies on existing granular MCP tools and existing store/apply-runner contracts.
- Non-task-scoped evolution MCP tools still use the server workspace root. This was already true before the change and remains outside issue #283 scope.
- The validation gate feedback capture reported a parse failure from the rendered prompt template placeholder block during PlaySpec phase completion. That did not affect the task phase routing or implementation output, and it is unrelated to the issue changes.

## Refactor Review

- `git diff --check` passed.
- No safe local refactor was applied. The changed test helper and assertions are already scoped to the MCP integration file, and further extraction would add indirection without reducing meaningful duplication.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/288
