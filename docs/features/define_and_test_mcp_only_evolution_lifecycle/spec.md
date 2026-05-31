# Define And Test MCP-Only Evolution Lifecycle Spec

## Scope

Define the supported MCP-only sequence after a workflow completes and cover it with integration tests. This change should document and test the existing granular MCP tools rather than introduce automatic proposal application or replace the tool surface.

In scope:

- MCP completion with `withEvolutionContext` where the agent wants final evolution context in completion output.
- MCP proposal generation from explicit evidence and task/session context.
- MCP duplicate handling for an existing active proposal that targets the same file.
- MCP update/refinement through an explicit `proposalId`.
- MCP evidence append and feedback-thread evidence append.
- MCP list/get, diff, skip, and apply status reporting.
- Explicit `approved: true` gate for apply.

Out of scope:

- Auto-applying proposals after completion.
- Weakening explicit approval for apply.
- Combining unrelated proposal targets.
- Adding viewer behavior or unrelated workflow engine behavior.

## Use Case Alignment

An MCP agent completes a PlaySpec workflow, preserves completion feedback/evidence, and then decides whether that run implies a workflow/prompt evolution proposal. The supported result must let the agent report one of:

- `skipped`: no proposal is created, or a proposal is explicitly skipped.
- `pending` or `refining`: a proposal exists and still needs human review/refinement.
- `applied`: an executable proposal was previewed and then applied with explicit approval.

## High-Level Current Implementation Summary

Verified:

- `src/mcp/server.ts` registers task lifecycle tools and evolution tools through `buildMcpServer()`.
- Task-scoped MCP tools call `resolveMcpTaskId()` via `resolveScopedTask()`. They do not read `.playspec/HEAD`.
- `playspec_complete_phase` delegates to `PlaySpecCore.completePhase()` and passes `withEvolutionContext` and `contextMode`.
- `playspec_generate_evolution_proposal` delegates to `generateEvolutionProposal()` with an explicitly resolved task id and returns `invokedBy: "mcp"`.
- `generateEvolutionProposal()` creates a new pending proposal when no active target overlap exists.
- `generateEvolutionProposal()` updates an existing proposal only when `proposalId` is supplied.
- New proposal generation rejects a duplicate active proposal targeting the same file with guidance to refine the existing proposal.
- `playspec_append_evolution_evidence`, `playspec_append_evolution_thread_evidence`, `playspec_update_evolution_proposal`, `playspec_skip_evolution_proposal`, `playspec_diff_evolution_proposal`, and `playspec_apply_evolution_proposal` call the existing evolution store/updater/runner paths.
- `playspec_apply_evolution_proposal` rejects unless `approved === true`.

Inferred:

- The current tool set is sufficient for the lifecycle; no helper tool is required for issue #283 if docs and tests clarify the sequence.

Open question:

- Whether `playspec_list_evolution_proposals` and related non-task-scoped evolution tools should accept `workspaceRoot` like task tools. Existing tests mostly run with matching server/workspace roots, so this issue should not broaden into workspace-root parity unless the lifecycle tests reveal a blocker.

## Relevant Files Reviewed

- `src/mcp/server.ts`: MCP tool registration and delegation.
- `src/mcp/context.ts`: task/session context resolution boundary.
- `src/evolution/proposal-generator.ts`: proposal generation, explicit refinement, duplicate target rejection.
- `src/evolution/proposal-store.ts`: store, update, append evidence, list/get, skip, validation.
- `src/evolution/feedback-updater.ts`: feedback thread evidence attachment.
- `src/evolution/apply-runner.ts`: diff/apply behavior and approval enforcement.
- `tests/integration/mcp-server.test.ts`: current MCP integration coverage.
- `README.md`: existing MCP tool listing and short typical MCP flow.
- `docs/evolution-feedback.md`: existing feedback/evolution concept docs.

## Active Entry Points And Bypasses

Active MCP entry points:

- `playspec_render_next_prompt`
- `playspec_complete_phase`
- `playspec_generate_evolution_proposal`
- `playspec_list_evolution_proposals`
- `playspec_get_evolution_proposal`
- `playspec_store_evolution_proposal`
- `playspec_update_evolution_proposal`
- `playspec_append_evolution_evidence`
- `playspec_append_evolution_thread_evidence`
- `playspec_skip_evolution_proposal`
- `playspec_diff_evolution_proposal`
- `playspec_apply_evolution_proposal`

Important bypasses:

- CLI evolution commands exercise the same underlying store/runner but do not prove the MCP-only sequence.
- Individual MCP tests prove registration or isolated behavior but do not prove the post-completion lifecycle contract.
- Direct writes under `.playspec/evolution` bypass validation and should not be part of the documented agent flow.

## Current Architecture

Verified flow:

```text
MCP client
  -> playspec_complete_phase(taskId/sessionId, withEvolutionContext?)
  -> PlaySpecCore.completePhase()
  -> completion result, feedback, evolution context when requested

MCP client
  -> playspec_generate_evolution_proposal(taskId/sessionId, evidence, target)
  -> resolveMcpTaskId()
  -> generateEvolutionProposal()
  -> EvolutionProposalStore.saveProposal() or updateProposal()

MCP client
  -> append/list/get/diff/skip/apply tools
  -> EvolutionProposalStore / appendFeedbackThreadEvidence / EvolutionApplyRunner
```

## Verified Behavior

- Apply has two gates: MCP rejects `approved: false`, and `EvolutionApplyRunner.apply()` also requires approval.
- Diff does not mutate targets.
- Store/update/append validate proposal objects and evidence refs.
- Terminal proposal statuses block further update/evidence append via store checks.
- Duplicate generation for the same active target is refused unless the caller uses explicit refinement.

## Problems

- README only lists MCP tools and a short task flow; it does not describe the MCP-only evolution sequence after completion.
- MCP tests cover individual pieces but do not assert a representative end-to-end sequence from completion to proposal status.
- Duplicate/existing proposal behavior is covered in CLI tests but not in the MCP lifecycle path.
- The documented tool list omits `playspec_append_evolution_thread_evidence`, although the server registers it.

## Proposed Direction

1. Add a dedicated documentation page for the MCP evolution lifecycle and link it from README.
2. Update README’s MCP section to include `playspec_append_evolution_thread_evidence` and point to the lifecycle doc.
3. Add MCP integration tests in `tests/integration/mcp-server.test.ts`:
   - Complete a task phase with `withEvolutionContext`, generate a proposal from explicit evidence, append evidence, list/get it, and assert pending/refining reporting.
   - Store an executable proposal, assert diff preview, assert apply rejects without `approved: true`, apply with approval, and assert applied status.
   - Generate a proposal, attempt duplicate generation for the same target and assert refusal, then refine the existing proposal with `proposalId` and assert revision/evidence update.
   - Append feedback thread evidence and fetch the updated proposal.

## File-By-File Plan

- `docs/mcp-evolution-lifecycle.md`: new agent-facing contract with supported sequence, state reporting, duplicate/refinement guidance, and approval gate notes.
- `README.md`: link to lifecycle doc and include missing thread-evidence tool in the registered tools list.
- `tests/integration/mcp-server.test.ts`: add representative MCP lifecycle tests using current helpers and evolution stores.
- No source changes expected unless tests reveal a small response/contract gap.

## Risks And Open Questions

- Risk: tests that apply executable proposals mutate temp workspace files; keep targets under `.playspec/templates/` or `.playspec/rules/` and use temp workspaces only.
- Risk: documenting a “happy path” could imply auto-apply. The doc must state apply is optional and approval-gated.
- Open question: broader explicit `workspaceRoot` support for non-task-scoped evolution tools is outside this issue unless needed by tests.

## Reader Aids

Final status reporting rules:

- No proposal generated: report `skipped` with reason.
- Proposal generated/refined and not terminal: report proposal `status` (`pending` or `refining`) and `revision`.
- Proposal skipped: report `skipped` and skip reason when present.
- Proposal applied: report `applied` plus apply report path.
- Proposal failed during apply: report `failed` plus apply report path and recovery guidance.
