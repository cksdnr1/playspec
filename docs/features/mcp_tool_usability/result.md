# Implementation and verification

Completed the remaining MCP usability contracts across all 48 tools (44 existing, four new read-only discovery tools).

- Every top-level argument has a tools/list description. Tool annotations describe read/write impact; rendering and evidence collection are not claimed strictly read-only.
- Store/update publish canonical proposal/action schemas, replacement-document requirements and server-managed metadata rules. Executable target roots come from the runner's exported constant.
- Workflow validation/install/export/edit, feedback-thread evidence and human-edit status retain explicit project scope. Workflow installation/removal remain explicitly user-global.
- New compact paginated list/get tools rediscover feedback thread and observation IDs. Proposal guidance distinguishes advisory refinement from executable preview.
- Successful responses retain text JSON/structured parity and add effective root and scoped inspection calls. Handler errors retain text and gain scoped discovery, typed approval/confirmation/context/rollback/filesystem codes and conservative retry behavior. Existing guided-phase instructions remain authoritative. No mutation or approval call is emitted in nextActions.

## Validation

`npm run build` passed. Focused MCP regressions: four files, 108 tests passed, including nine new real stdio scenarios. Full `npm test`: 54 files, 797 tests passed on stable final source (203.75 seconds), including CLI, packaging, rollback, validation, transaction, migration and feedback regressions.

Compiled `dist/mcp/index.js` smoke passed: 48-tool discovery, canonical proposal schema, cross-workspace observation create/list/get/status update and server-workspace isolation. Real-client tests also cover all workflow phase editors, source validation/export, isolated user-global installation/removal, proposal replacement/evidence preservation, thread discovery/append, task links/context/evidence/snapshots, sessions and nonmutating recovery suggestions. Every inspected returned call has a registered tool, schema-valid arguments and the effective project root.

Final review: docs/features/mcp_tool_usability/review.md. Native SDK pre-handler schema errors retain SDK format. New list responses are bounded, but stores still scan their directories. No independent model execution or human usability study is claimed.

Deployment: rebuild the main checkout after merge; the global wrapper points at its dist/mcp/index.js. Existing MCP clients must reconnect. No init or installed workflow rewrite is necessary.
