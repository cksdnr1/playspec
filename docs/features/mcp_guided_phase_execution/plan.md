# Implementation plan

1. Add transport-independent phase context types and builder with resolved paths, hashes, report schema, stable revision and completion args. Render context and prompt coherently under the existing task lock.
2. Add optional revision checking to completion after idempotent replay, before any writes. Keep existing callers compatible.
3. Enrich MCP prompt/status/terminal responses, field descriptions, structured result/error content and workspace-scoped read-only recovery calls. Add a MCP-specific instruction suffix; preserve raw CLI prompts.
4. Add typed validation failures and documentation for a copyable render-to-complete flow.
5. Test context coherence, stable args, revision ABA/replay, gate report authoring, harness/terminal behavior, explicit workspace/session routing, historical inspection, schema and structured errors. Test actual stdio protocol in addition to direct handler tests. Run build and full suite on stable source.

## Review limits
A same-runtime reviewer cannot establish independent semantic evaluation. Report scores reflect this written contract review only. Readiness is not inferred from file existence; runtime checks still own completion.
