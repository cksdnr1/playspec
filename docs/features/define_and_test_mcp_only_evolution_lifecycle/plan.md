# Define And Test MCP-Only Evolution Lifecycle Plan

## Ordered Implementation Steps

1. Document the lifecycle contract.
   - Add `docs/mcp-evolution-lifecycle.md`.
   - Describe the supported sequence from workflow completion to final proposal status.
   - Include explicit duplicate/refinement behavior and the apply approval gate.
   - Define final status reporting for `skipped`, `pending`, `refining`, `applied`, and `failed`.

2. Update README MCP references.
   - Add `playspec_append_evolution_thread_evidence` to the registered MCP tools list.
   - Link the MCP lifecycle doc from the MCP section.
   - Keep the short typical MCP task flow, but point agents to the evolution sequence for post-run proposal handling.

3. Add MCP lifecycle integration coverage.
   - Extend `tests/integration/mcp-server.test.ts`.
   - Use existing temp workspace helpers and registered MCP tool handlers.
   - Cover completing a phase with `withEvolutionContext`, generating a proposal from explicit evidence, appending evidence, listing/fetching, and reporting pending/refining status.
   - Cover duplicate target refusal and explicit `proposalId` refinement.
   - Cover feedback-thread evidence append and fetching the updated proposal.
   - Cover executable proposal diff, apply rejection without approval, apply with `approved: true`, and applied status.

4. Run focused validation.
   - Run `pnpm exec vitest run tests/integration/mcp-server.test.ts`.
   - Run `pnpm build`.
   - Run broader tests if focused changes pass and time permits: `pnpm test`.

## Files To Edit

- `docs/mcp-evolution-lifecycle.md`
- `README.md`
- `tests/integration/mcp-server.test.ts`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/result.md`
- `docs/features/define_and_test_mcp_only_evolution_lifecycle/pr.md`

## Tests To Add Or Update

- New MCP integration test: completion plus new proposal lifecycle.
  - Entry point: `playspec_complete_phase`.
  - State/data update: completion record and proposal stored under `.playspec/evolution/proposals`.
  - Propagation/user-visible behavior: MCP response includes completion metadata; generated/list/get responses expose proposal status/revision.

- New MCP integration test: duplicate target then explicit refinement.
  - Entry point: second `playspec_generate_evolution_proposal`.
  - Validation: duplicate active target is refused.
  - State/data update: explicit `proposalId` call updates the existing proposal and writes a revision.
  - User-visible behavior: MCP response reports the existing proposal revision and evidence refs.

- New MCP integration test: evidence/thread evidence append.
  - Entry point: `playspec_append_evolution_evidence` and `playspec_append_evolution_thread_evidence`.
  - State/data update: proposal revision increments and evidence refs include appended refs.
  - User-visible behavior: `playspec_get_evolution_proposal` returns updated evidence refs.

- New MCP integration test: diff/apply gates.
  - Entry point: `playspec_diff_evolution_proposal` and `playspec_apply_evolution_proposal`.
  - Mutation boundary: executable target remains allow-listed under `.playspec/templates/`.
  - Approval gate: `approved: false` rejects and does not mutate.
  - User-visible behavior: `approved: true` applies and proposal status becomes `applied`.

## Old Paths, Bypasses, And Partial Migration Risks

- CLI evolution tests are not sufficient evidence for MCP. New tests must invoke MCP tool handlers directly.
- Direct proposal file writes bypass validation and should be limited to test setup only where needed to seed a known proposal.
- Non-task-scoped MCP evolution tools currently use the server workspace root; do not add broader `workspaceRoot` support in this issue unless needed by the lifecycle tests.
- Generated proposals use `source.generationSource: "cli"` through shared generator code. MCP invocation is reported in the response as `invokedBy: "mcp"`; do not change schema metadata for this issue.

## Risks

- Applying executable proposals mutates files. Keep tests confined to temp workspaces and `.playspec/templates/` allow-listed targets.
- Duplicate/refinement docs must be explicit that the second proposal is refused unless the agent identifies and refines the existing proposal.
- Documentation must not imply automatic proposal creation or automatic apply after workflow completion.

## Rollback Notes

- Revert the docs and test additions.
- No production state migration or persistent schema change is planned.
- No source behavior changes are expected.

## Completion Criteria

- Docs explain the supported MCP-only sequence from completion through proposal handling.
- README links the lifecycle and lists all relevant MCP tools.
- MCP integration tests cover new proposal, duplicate/refinement, evidence append/fetch, thread evidence, diff/apply gates, and final status reporting.
- Validation commands pass or failures are documented with the exact command and reason.
