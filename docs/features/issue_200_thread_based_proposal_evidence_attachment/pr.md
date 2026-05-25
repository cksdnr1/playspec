# PR Notes: Issue 200

Fixes #200

## Summary

- Added explicit feedback-thread evidence attachment through `appendFeedbackThreadEvidence(workspaceRoot, { proposalId, threadId })`.
- Added CLI command `playspec evolution append-thread-evidence <proposalId> <threadId>`.
- Added MCP tool `playspec_append_evolution_thread_evidence`.
- Reused existing proposal evidence revision semantics and pending/refining status guards.
- Added focused service, CLI, and MCP coverage.

## Changed Files

- `src/evolution/feedback-updater.ts`
- `src/evolution/types.ts`
- `src/evolution/index.ts`
- `src/cli/commands/evolution.ts`
- `src/cli/index.ts`
- `src/mcp/server.ts`
- `tests/integration/evolution-feedback-updater.test.ts`
- `tests/cli.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_200_thread_based_proposal_evidence_attachment/spec.md`
- `docs/features/issue_200_thread_based_proposal_evidence_attachment/plan.md`
- `docs/features/issue_200_thread_based_proposal_evidence_attachment/result.md`
- `docs/features/issue_200_thread_based_proposal_evidence_attachment/pr.md`

## Tests Run

- `pnpm test tests/integration/evolution-feedback-updater.test.ts tests/integration/mcp-server.test.ts tests/cli.test.ts`
- `pnpm build`
- `git diff --check`
- `pnpm test`
- Safe-refactor rerun: `pnpm test tests/integration/evolution-feedback-updater.test.ts`

## PlaySpec Task

- `issue_200_phase_validation_feedback_to_prompt_evolution_signals`

## Risk Notes

- This is stacked on `origin/agent/issue-199-phase-validation-feedback`.
- The implementation intentionally keeps proposal evidence source as `append-evidence`; thread-specific meaning is in the command/tool name and evidence note.
- Duplicate explicit thread attachment appends duplicate evidence refs by existing proposal revision semantics.
- Reusable agent guidance: no new AGENTS.md guidance is needed. The existing evolution safety rules already cover no auto-apply, explicit IDs, and no direct mutation.
