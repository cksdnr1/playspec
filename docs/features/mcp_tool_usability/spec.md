# MCP tool usability

## Scope and use case
An MCP client should discover argument structure, choose a project explicitly, retain that project through follow-up calls, and recover with read-only calls. Cover every registered tool, including workflow editing, evolution, sessions, links, context, harness and rollback. Preserve existing tool names, result fields, CLI behavior and user-global workflow installation semantics. Add read-only discovery of feedback threads and human edit observations.

## Verified architecture and evidence
`src/mcp/server.ts` registers 44 tools. Task operations already resolve explicit task/session context without CLI HEAD. The guided phase flow already emits structured results and completion arguments. Other handlers frequently omit recovery context. WorkflowEditor supports project workflows and validates template paths against the workflow templates directory; WorkflowInstaller installs/removes user-global workflows. Evolution stores already expose list/load methods but MCP lacks thread/observation discovery.

| Artifact | Fields | Literal contract and treatment |
| --- | --- | --- |
| src/evolution/schemas.ts | EvolutionProposalSchema | Reuse the canonical object, action discriminators and enums in MCP input schemas; no parallel proposal model. |
| src/evolution/proposal-store.ts | normalizeIncomingProposalForUpdate | Update is a replacement document, with id/revision/timestamps/status/evidence defaults supplied by the store; other document fields remain required. |
| src/mcp/server.ts | workspaceRoot | Existing optional override resolves relative to server workspace. Add to missing APIs and propagate in response calls. |
| src/workflow/workflow-editor.ts | templatePath | Existing file relative to resolved workflow templateDir, not workspace root. |
| src/evolution/schemas.ts | HumanEditObservationStatusSchema | recorded, ignored, superseded; status mutation accepts ignored/superseded only. |

## Problems and proposed behavior
Expose a typed full proposal on store and a typed replacement document on update, preserving optional server-managed metadata. Describe all top-level input fields, using operation-specific descriptions where shared field names differ. Explain path bases, ID discovery, defaults, link direction, global installation impact and destructive recovery scope.

All workspace-sensitive tools accept workspaceRoot. User workflow install/remove remain user-global; workspaceRoot selects source resolution/inspection and does not relocate the user store. Scope workflow editor/loader/export, thread evidence and human-edit status to the requested workspace.

Use one MCP registration adapter for additive effective-workspace metadata, JSON text/structured result parity, scoped inspection nextActions and domain-specific error recovery. Preserve authoritative nextActions from the existing phase flow. Do not suggest automatic apply, completion, reset, rollback, workflow deletion or review approval. Errors retain original message/code/hint and fail conservatively on unknown failures; missing entity guidance provides discovery, not blind retries. SDK schema failures retain SDK-native behavior. Existing prompt inspection may recover pending transactions and write prompt/context snapshots, so render and evidence collection must not be annotated strictly read-only. The new guidance does not add automatic mutations. Publish executable allowed roots from the same exported constant used by the runner (.playspec/templates/ and .playspec/rules/). Workflow directory basenames must match workflow IDs. Approval/confirmation failures receive explicit codes.

Add list/get feedback threads and list/get human edit observations using existing stores. Lists return bounded compact pages; get returns full stored entities. IDs must be rediscoverable without retaining a write response. Proposal responses guide inspection/diff, and rollback/harness responses guide status/plan inspection rather than mutation.

## File plan and entry points
Add a transport-only MCP tool-contract helper and route all server registrations through it. Update missing scoped handlers and canonical proposal schemas in server.ts. Add direct handler tests for project isolation and recovery plus real stdio tests for tools/list schema discovery and returned-call execution. Document lifecycle, path and approval contracts. No Core-to-CLI coupling or changes to approval enforcement.

## Acceptance and risks
A fresh client can discover schemas for every tool; create/edit/inspect a workflow in project B while server runs in A; record/rediscover/update an observation in B; discover a feedback thread and append its evidence to a B proposal; store/update/inspect/diff a canonical proposal. Every emitted nextAction must name a registered inspection tool with valid arguments and the effective workspace. Unknown failures must not fabricate successful recovery. Existing core phase guidance and full regression suite pass. User-global effects are explicit and unchanged. These tests establish protocol contracts, not independent model judgments or universal ease of use. Large list payloads are bounded for new discovery tools; existing proposal-list behavior remains compatible.
