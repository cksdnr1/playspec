# Guided MCP execution

Start with `playspec_list_workflows` and `playspec_show_workflow` to inspect the effective workflow and its variable declarations. Both accept `workspaceRoot`, so discovery and task creation can target a project other than the server's working directory. Create with the required variables, then follow the returned `nextActions` call to render the phase.

## Render, work, complete

`playspec_render_next_prompt` returns the existing `taskId` and `prompt`, plus `workspaceRoot`, `phaseId` and `execution`:

- `allowedResults`, `resultRequired`, and `nextByResult` describe this phase's routing choices.
- `requiredOutputs` lists paths explicitly enforced by the engine for this phase. The prompt contains the broader authoring/implementation requirements.
- `completion` contains the MCP tool and ready-to-use arguments. It is null for a blocked harness or a noncurrent phase inspection.
- `validation`, when present, provides the report path, task/phase identity, threshold, rubric, report JSON Schema, evaluated artifact paths and current SHA-256 hashes. Missing/unreadable artifacts have null hashes and explicit status.

For a connected TypeScript SDK client:

```js
const rendered = await client.callTool({
  name: 'playspec_render_next_prompt',
  arguments: { taskId, workspaceRoot },
});
const phase = rendered.structuredContent;
// Perform the work described by phase.prompt with your editing/testing tools.
// For a validation phase, review the artifacts and author the report first.
const completion = phase.execution.completion;
if (!completion) {
  throw new Error("Inspect phase.nextActions; no completion is available.");
}
// After performing the phase:
const args = { ...completion.arguments };
if (phase.execution.resultRequired) {
  args.result = reviewDecision; // Your reviewed decision from execution.allowedResults.
}
const completed = await client.callTool({
  name: completion.tool,
  arguments: args,
});
// On transport failure, retry this exact call with the same args/result.
```

The illustration assumes a client that can edit project files and run checks. PlaySpec provides workflow guidance and validates completion; it does not replace the coding client's filesystem and test tools. Write a report as YAML or JSON at `validation.reportPath`, relative to the returned `workspaceRoot`. Do not submit the illustrative code before actually performing the phase.

For a gated phase, adding `result` is an explicit reviewer decision. The server does not manufacture scores, findings or verdicts. Use `validation.reportSchema` and `validation.rules`: schema validation alone cannot express all rubric arithmetic, uniqueness and cross-file freshness rules. Rehash artifacts after editing them; completion independently checks current evidence.

## Retry and stale state

Copy `completion.arguments` instead of inventing guard values. The server supplies `expectedPhaseId`, a stable `requestId`, and `expectedRevision`. Unchanged task/workflow/ledger state produces identical arguments. Task state, workflow definition or completion history changes can invalidate the revision, including returning to the same phase after a different completion. This revision is a freshness check, not an authorization credential; external artifact edits are checked by validation hashes.

A committed request replays its original completion even after the workflow advances. Its response has `replayed: true` and offers `playspec_get_status` to discover the actual current state instead of treating the recorded next phase as live state. Do not change its result when retrying. A conflicting result returns `completion_request_conflict`. On `phase_advanced` or `phase_revision_stale`, inspect state and render the current phase, then perform that phase before completing it. Never blindly replace guards and resubmit old work.

## Errors and next calls

Successful results retain JSON text in `content` and additionally return `structuredContent`. Handler errors retain their existing text and `isError: true`, and return:

```json
{
  "error": {
    "code": "validation_report_required",
    "message": "Validation report is required at the configured path.",
    "hint": "Render current guidance and author evidence before retrying.",
    "details": { "reportPath": "docs/features/example/spec-validation.yaml" },
    "retryable": false,
    "nextActions": [
      { "tool": "playspec_render_next_prompt", "arguments": { "taskId": "example" } }
    ]
  }
}
```

Use each `nextActions` entry's `tool` as SDK `name` and pass its `arguments`. Returned calls preserve the effective workspace and task/session context. They inspect state; they do not automatically complete, reset the harness, or bypass a gate. Missing task/session context offers task discovery. Missing variables include their names and a scoped workflow-inspection call. Missing prerequisites include the gate phase and an inspection call for it. Terminal completion/status offers task inspection instead of another completion.

`retryable: true` currently identifies lock contention. Other errors require inspection/correction or an explicit decision before retrying. Unknown handler failures use `operation_failed`; do not assume a retry will succeed. MCP SDK input-schema failures can occur before the handler and retain the SDK's native error format. Discover field descriptions through `tools/list`.

`playspec_render_phase_prompt` returns the same context shape for inspection. Only an active current phase with an unblocked harness offers a completion call. CLI prompt rendering stays unchanged; MCP prompt delivery appends explicit MCP execution instructions.

Legacy clients may keep parsing text JSON. Existing manually assembled MCP completion calls still require `expectedPhaseId` and `requestId`; `expectedRevision` is additive for those clients. New clients should copy all server-provided arguments. Core and CLI completion guard compatibility is preserved.
