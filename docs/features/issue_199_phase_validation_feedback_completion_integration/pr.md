Fixes #199

## Summary

- Capture enabled phase validation feedback inside `PlaySpecCore.completePhase()` so CLI and MCP completion share the same behavior.
- Record optional feedback success/failure metadata on completion results, ledger events, and completion markdown.
- Update feedback threads through the existing extractor/updater path and honor configured failure policies before phase state mutation.
- Surface feedback capture summaries in CLI completion output.

## Changed Files

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/cli/commands/complete.ts`
- `tests/integration/completion-engine.test.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_199_phase_validation_feedback_completion_integration/spec.md`
- `docs/features/issue_199_phase_validation_feedback_completion_integration/plan.md`
- `docs/features/issue_199_phase_validation_feedback_completion_integration/result.md`
- `docs/features/issue_199_phase_validation_feedback_completion_integration/pr.md`

## Tests Run

- `pnpm test tests/integration/completion-engine.test.ts`
- `pnpm test tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`
- `git diff --check`
- Safe-refactor rerun: `pnpm test tests/integration/completion-engine.test.ts tests/integration/mcp-server.test.ts`
- Safe-refactor rerun: `pnpm build`
- Final-stack rerun after restack on #198: `pnpm build`
- Final-stack rerun after restack on #198: `pnpm test tests/integration/completion-engine.test.ts tests/integration/mcp-server.test.ts`
- Final-stack rerun after restack on #198: `pnpm test`

## PlaySpec Task

- `issue_199_phase_validation_feedback_completion_integration`

## Risk Notes

- Feedback extraction requires configured workflows to produce a machine-readable `playspecFeedback` block in the selected `scoreSource.artifactRole` artifact when `required: true`.
- This change records prompt evolution signals only; it does not mutate workflow templates or apply proposals.
- This branch is stacked on the #198 feedback extractor dependency branch and the prior feedback stack unless those PRs merge first.

## Reusable Agent Guidance

No reusable agent guidance change is needed. The implementation follows existing Core/CLI/MCP boundaries and uses the established PlaySpec workflow.
