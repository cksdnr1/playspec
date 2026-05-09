# Issue 94 MCP Link And Missing Tools Spec

## Goal

Expose missing PlaySpec CLI capabilities through MCP so agents can manage task links and workflow assets without shelling out to the CLI.

## Scope

- Add MCP tools for task link creation and removal.
- Add MCP tools for workflow list, show, validate, install, remove, export, and phase editing.
- Preserve the MCP context rule: source task resolution must use explicit `sourceTaskId`, `taskId`, or `sessionId`; it must not read `.playspec/HEAD` or use `ActiveTaskResolver`.
- Reuse existing Core, storage, workflow, and evolution implementations.
- Keep evolution MCP tools as-is because proposal generation, proposal CRUD, diff/apply, and human edit observation tools are already present.

## Tool Contracts

- `playspec_link_tasks`: inputs `sourceTaskId?`, `taskId?`, `sessionId?`, `targetTaskId`, `type`.
- `playspec_unlink_tasks`: inputs `sourceTaskId?`, `taskId?`, `sessionId?`, `targetTaskId`, `type?`.
- `playspec_list_workflows`: returns effective workflows after project/user/builtin precedence.
- `playspec_show_workflow`: returns source, paths, and parsed workflow definition.
- `playspec_validate_workflow`: validates a workflow directory.
- `playspec_install_workflow`: installs a workflow directory.
- `playspec_remove_workflow`: requires `confirm: true`.
- `playspec_export_workflow`: exports an installed workflow.
- `playspec_workflow_add_phase`, `playspec_workflow_remove_phase`, `playspec_workflow_reorder_phase`, and `playspec_workflow_set_template`: mutate project workflows only through the validated workflow editor.

## Safety

- Link source fallback uses `resolveMcpTaskId()` only.
- Workflow editing is limited to project workflows, validates schema and templates before and after write, creates backups, and emits edit reports.
- Workflow removal has an explicit confirmation gate.

## Acceptance

- MCP registration test includes new link and workflow tools.
- MCP link test proves no HEAD fallback.
- MCP workflow test edits a project workflow end to end.
- Full build and test suite pass.
