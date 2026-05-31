# MCP Evolution Lifecycle

This is the supported MCP-only sequence for handling workflow evolution after a PlaySpec task run. It uses the existing granular MCP tools and does not auto-apply proposal changes.

## Supported Sequence

1. Complete the current workflow phase.

   Use `playspec_complete_phase` with `taskId` or `sessionId`. Set `withEvolutionContext: true` when the agent needs completion output to include evolution context for final review or follow-up proposal work.

   ```json
   {
     "sessionId": "codex-main",
     "result": "approved",
     "withEvolutionContext": true,
     "contextMode": "compact"
   }
   ```

2. Preserve explicit evidence.

   Keep the evidence path from completion output, `playspec_collect_evidence`, review artifacts, or a feedback thread. Evolution proposal generation requires explicit evidence; the MCP tool does not infer it from `HEAD`.

3. Generate a proposal from evidence.

   Call `playspec_generate_evolution_proposal` with explicit task context, evidence path, target path, summary, rationale, and risk.

   ```json
   {
     "sessionId": "codex-main",
     "fromEvidence": ".playspec/tasks/active/my_task/evidence/phaseimplementation_git_status.txt",
     "target": ".playspec/templates/example.md",
     "summary": "Clarify post-run evolution guidance.",
     "rationale": "The run produced repeatable feedback that should be reviewed as a prompt change.",
     "risk": "low",
     "generatedId": "clarify_mcp_evolution_guidance"
   }
   ```

   A new generated proposal is stored as `pending`. The MCP response includes `invokedBy: "mcp"`, the resolved `taskId`, paths, and proposal status/revision.

4. Dedupe and refine deliberately.

   If another active proposal already targets the same file, generation is refused instead of silently creating a duplicate. Use `playspec_list_evolution_proposals` or `playspec_get_evolution_proposal` to identify the active proposal, then call `playspec_generate_evolution_proposal` again with `proposalId` to refine that existing proposal.

   ```json
   {
     "sessionId": "codex-main",
     "proposalId": "clarify_mcp_evolution_guidance",
     "fromEvidence": "docs/review-notes.md",
     "target": ".playspec/templates/example.md",
     "summary": "Add reviewer evidence to the existing proposal.",
     "rationale": "This is the same target and improvement area.",
     "risk": "low"
   }
   ```

5. Append supporting evidence.

   Use `playspec_append_evolution_evidence` for file evidence and `playspec_append_evolution_thread_evidence` for a stored feedback thread.

   ```json
   {
     "proposalId": "clarify_mcp_evolution_guidance",
     "path": "docs/review-notes.md",
     "note": "Reviewer confirmed this belongs with the existing proposal."
   }
   ```

6. List and fetch before reporting.

   Call `playspec_list_evolution_proposals` to find current proposals and `playspec_get_evolution_proposal` to fetch the exact proposal plus validation report when present.

7. Preview executable changes when applicable.

   Use `playspec_diff_evolution_proposal` before applying executable proposals. Diff previews do not mutate target files.

8. Apply only with explicit approval.

   `playspec_apply_evolution_proposal` requires `approved: true`. A false or missing approval is rejected. Apply is optional; completion and proposal generation never apply changes automatically.

   ```json
   {
     "proposalId": "clarify_mcp_evolution_guidance",
     "approved": true
   }
   ```

9. Report final status.

   Use the fetched proposal status and apply report metadata:

   - `skipped`: no proposal was created, or `playspec_skip_evolution_proposal` marked it skipped.
   - `pending`: proposal exists and awaits review.
   - `refining`: proposal exists and has been updated but still needs review.
   - `applied`: executable proposal was diffed, explicitly approved, and applied.
   - `failed`: apply attempted and failed; report `latestApplyReportPath` and recovery guidance from the apply result.

## Safety Contract

- MCP task context must use `taskId` or `sessionId`; MCP context resolution does not read `.playspec/HEAD`.
- Generated proposals require explicit evidence paths.
- Active duplicate proposal targets are refused unless the caller names the existing `proposalId` for refinement.
- Diff is preview-only.
- Apply is gated by `approved: true`.
- Workflow completion does not generate, update, skip, diff, or apply proposals by itself.
