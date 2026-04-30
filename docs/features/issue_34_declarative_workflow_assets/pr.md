# Draft PR Notes

Fixes #34

## Summary

- Replace task `workflowType` writes with `workflow` and keep a read-only legacy fallback for existing task YAML.
- Load built-in workflow runtime assets from `src/preset/assets/workflows/<id>/workflow.yaml` and user workflows from `~/.playspec/workflows/<id>/workflow.yaml`.
- Move templates under workflow-local `templates/` directories and reject template traversal/outside references.
- Resolve variables from engine built-ins, workflow defaults, phase defaults, and task variables, with explicit errors for unknown and circular defaults.
- Declare workflow artifacts in `workflow.yaml` and use them for relevant files and phase-execution planning context.
- Add workflow CLI commands: `list`, `show`, `validate`, `install`, `remove`, and `export`.

## Changed Files

- Core/task schema and storage: `src/core/types.ts`, `src/core/schemas.ts`, `src/storage/yaml-task-store.ts`.
- Workflow runtime: `src/workflow/workflow-loader.ts`, `src/workflow/workflow-registry.ts`, `src/workflow/workflow-installer.ts`.
- Rendering/variables: `src/template/template-renderer.ts`, `src/template/variable-resolver.ts`.
- CLI: `src/cli/index.ts`, `src/cli/commands/create.ts`, `src/cli/commands/workflow.ts`.
- Assets: `src/preset/assets/workflows/**`, with old preset workflow/template copies removed.
- Tests: updated unit and integration coverage for workflow assets, variable defaults, template roots, artifacts, and CLI behavior.

## Tests Run

- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

`issue_34_declarative_workflow_assets`

## Risk Notes

- Project-local `.playspec/workflows` and `.playspec/templates` runtime overrides are intentionally no longer used.
- Existing task YAML with `workflowType` remains readable, but new writes use `workflow`.
- Workflow install/export is filesystem-only; remote Git workflow install is out of scope.

## Reusable Agent Guidance

No new reusable agent guidance is needed. Existing repository guidance already covers phase boundaries and path alias usage; this change is implementation-specific.
