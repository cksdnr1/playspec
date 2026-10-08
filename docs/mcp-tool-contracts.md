# Using the complete MCP tool surface

All 48 tools publish descriptions for every top-level argument in `tools/list`, an optional `workspaceRoot`, and read/write impact annotations. Proposal store/update also publish canonical object and action schemas. Success responses preserve legacy JSON text and expose the same object as `structuredContent`, with effective `workspaceRoot` and `nextActions`. Additional fields are additive; clients should accept unknown response fields.

## Keep the project through the entire chain

`workspaceRoot` defaults to the server workspace. Relative overrides resolve against that server workspace. Copy the returned effective root into subsequent calls, or copy a returned `nextActions` call directly. Session bindings and task IDs are resolved within that project; MCP does not use CLI HEAD.

Workflow validation, export and all four workflow phase editors now accept the same project override as list/show. Templates are existing files relative to the resolved workflow's `templateDir`, not relative to the workspace. Workflow directories passed to validation/installation must have a basename matching `workflow.yaml`'s `id`.

**Workflow installation/removal are user-global operations**, shared across projects. Supplying workspaceRoot changes source path resolution, not installation scope. Project-local copies take precedence and remain after removal of a user copy. To create an editable project override, export with `outDir: ".playspec/workflows/<workflowId>"`, inspect it, then use the phase editors. Editing validates compatibility with active task phases and produces backup/report paths. `replacement` in phase removal is report metadata; it does not migrate tasks or rewrite routing.

## Rediscover evidence IDs

| Discover | Inspect | Explicit mutation after review |
| --- | --- | --- |
| playspec_list_feedback_threads | playspec_get_feedback_thread | playspec_append_evolution_thread_evidence |
| playspec_list_human_edit_observations | playspec_get_human_edit_observation | playspec_update_human_edit_observation_status |
| playspec_list_evolution_proposals | playspec_get_evolution_proposal | playspec_update_evolution_proposal |

The new thread/observation lists return compact pages: default `limit: 50`, maximum 500, zero-based `offset`. Observation lists optionally filter `recorded`, `ignored` or `superseded`. Follow returned get calls to inspect full history and references; do not depend on retaining the original write response. Pagination bounds response size, while existing stores still scan their directories.

Human observation `before`/`after` arguments are workspace-relative file references, not inline content. Recording an observation does not modify its target. Both recording and changing status use the explicitly requested workspace.

## Author and review proposal documents

`playspec_store_evolution_proposal` accepts the canonical full document described in `tools/list`: metadata, source, target files, evidence, risk, actions, rationale and review. `playspec_generate_evolution_proposal` creates advisory `propose_file_change` actions from an existing evidence file. Advisory actions cannot be diffed/applied until an agent authors executable actions through update; responses explain this instead of suggesting an unusable diff.

`playspec_update_evolution_proposal` takes a **replacement document**, not a field patch. Supply `source`, `targetFiles`, `riskLevel`, `actions`, `rationale` and `review`. The server supplies ID, incremented revision and timestamps; omitted status/evidenceRefs retain their existing values. Copy the current proposal, make the intended edits, and submit it. Only pending/refining proposals are editable. Artifact/evidence paths are workspace-relative and must exist.

Executable actions are `replace_file`, `append_section` and `replace_section`, with workspace-relative targetPath and content (plus sectionName for section actions). Executable writes are currently allowed under `.playspec/templates/` and `.playspec/rules/`; these roots are published from the same constant used by runtime enforcement. Workflow-template paths outside those roots remain advisory targets. Runtime path containment and allowed-root rules remain authoritative. Inspect the returned diff before explicitly authorizing `playspec_apply_evolution_proposal` with `approved: true`. Review metadata does not grant this authorization.

## Recovery and next actions

Handler failures retain human-readable text and return `structuredContent.error` with code, message, hint, retryability and scoped inspection calls. Filesystem missing/permission failures and context/rollback errors have specific codes; unknown failures stay `operation_failed` and are not declared retryable. Native SDK input-schema failures occur before the handler and retain the SDK's error format; inspect `tools/list` and fix the supplied arguments.

`nextActions` contains discovery, status, inspection or preview calls. It never supplies completion, apply approval, harness reset, state recovery or git rollback. Existing phase-prompt inspection may recover a pending completion transaction and write prompt/context snapshots; its MCP annotation therefore does not claim it is strictly read-only. Evidence collection also writes evidence and is not annotated read-only.

For a blocked harness, inspect status and failure reasons before explicitly resetting with the review reason. For recovery, inspect desync and rollback preview: state-only recovery restores task state, while git rollback may change worktree state and still requires `confirm: true`. No suggested call authorizes either operation. Re-read task status after explicit recovery. See [phase execution](mcp-guided-execution.md) for guarded completion, report authoring and retries.

After upgrading the built server, reconnect existing MCP clients to refresh the running process and tools/list schemas. No init or workflow rewrite is needed for these adapter changes.
