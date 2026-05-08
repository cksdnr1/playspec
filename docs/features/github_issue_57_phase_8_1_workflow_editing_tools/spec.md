# GitHub Issue 57 Phase 8.1 Workflow Editing Tools Spec

## Scope

Implement only PlaySpec Evolution Phase 8.1: validated workflow editing tools for installed workflow assets. The goal is to let users perform common workflow changes through CLI commands that validate, back up, report, and preserve active task compatibility instead of directly editing workflow YAML.

Out of scope:

- Markdown viewer behavior.
- DAG or subtask execution.
- Evolution proposal-driven workflow mutation.
- Editing built-in preset assets in `src/preset/assets/`.
- Mutating task records during workflow edits.

## Commands

Add these subcommands under `playspec workflow`:

- `add-phase --workflow <id> --after <phaseId> --id <newPhaseId> --title <title> --template <templatePath>`
- `remove-phase --workflow <id> --id <phaseId> [--replacement <phaseId>]`
- `reorder-phase --workflow <id> --id <phaseId> --after <phaseId>`
- `set-template --workflow <id> --phase <phaseId> --template <templatePath>`

Commands mutate only installed project workflow assets at `.playspec/workflows/{workflowId}/workflow.yaml`. A workflow resolved from the built-in preset source or user-home source is rejected for editing. Existing install/export commands remain responsible for copying workflows into project scope.

## Editing Rules

All commands load the effective workflow through the existing workflow loader. Edits require the resolved workflow source to be `project`.

`add-phase`:

- Rejects duplicate phase IDs.
- Rejects missing `--after` phase.
- Rejects missing or escaping template paths before creating a backup.
- Inserts the new phase immediately after `--after`.
- Adds a minimal phase definition with `title` and `template`.

`remove-phase`:

- Rejects missing phase IDs.
- Rejects removal when any active task using the workflow has `currentPhase` equal to the removed phase.
- Accepts `--replacement` only as report metadata for successful removals.
- Does not update task records.

`reorder-phase`:

- Rejects missing phase IDs.
- Rejects moving a phase after itself.
- Preserves the exact set of phase IDs and changes only `phaseOrder`.

`set-template`:

- Rejects missing phase IDs.
- Rejects missing or escaping template paths before creating a backup.
- Updates only the selected phase template.

## Validation, Backup, And Report

The workflow edit primitive validates the proposed workflow before writing. It must:

1. Resolve and parse the installed project workflow.
2. Validate command-specific preconditions that do not require mutation.
3. Compute active task compatibility from active tasks whose `workflow` matches the edited workflow.
4. Reject any edit that would orphan an active task current phase.
5. Validate the proposed workflow schema and template references.
6. Create a backup at `.playspec/workflows/.backups/{workflowId}-{timestamp}/workflow.yaml`.
7. Write the updated workflow atomically.
8. Validate the written workflow can load.
9. Write a report at `.playspec/workflows/.reports/{workflowId}-{timestamp}.yaml`.

Reports include:

- command name;
- workflow ID;
- target path;
- backup path;
- before and after phase IDs;
- active task compatibility result;
- validation result;
- replacement metadata when supplied;
- timestamp and success state.

If validation fails before backup/write, no backup or report is required. If a failure happens after backup creation, the command should surface the error with the backup path when available.

## Architecture

Add workflow editing primitives in `src/workflow/` so CLI code remains adapter-only. The implementation may reuse `WorkflowLoader`, `WorkflowRegistry`, `YamlTaskStore`, `WorkflowDefinitionSchema`, YAML parsing/stringifying, and existing path helpers.

Core remains independent of CLI. MCP receives no workflow edit tools in this phase.

## Tests

Add focused tests for:

- adding a phase, validating the updated workflow loads, and creating backup/report files;
- rejecting duplicate phase IDs and missing template paths before backup/write;
- removing a non-active phase and recording `replacement` only in the report;
- rejecting removal of an active task current phase even with `--replacement`;
- reordering phases while preserving the same phase IDs;
- setting a template to an existing template path;
- rejecting edits against built-in preset assets.
