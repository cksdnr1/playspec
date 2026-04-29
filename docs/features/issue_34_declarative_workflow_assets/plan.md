# Declarative Workflow Assets Implementation Plan

## Ordered Steps

1. Add workflow asset model.
   - Edit `src/core/types.ts`, `src/core/schemas.ts`, and `src/workflow/workflow-schema.ts`.
   - Add workflow metadata, variable declarations, artifact declarations, and phase-level variable declarations.
   - Rename task-facing fields from `workflowType` to `workflow`, with a narrow legacy read fallback only if needed for existing historical task fixtures.

2. Add registry-backed workflow loading.
   - Add `src/workflow/workflow-registry.ts`.
   - Resolve built-ins from `src/preset/assets/workflows/<id>/workflow.yaml`.
   - Resolve user workflows from `~/.playspec/workflows/<id>/workflow.yaml`.
   - Keep task state out of `.playspec/workflows`.

3. Move built-in assets.
   - Create `src/preset/assets/workflows/<workflow-id>/workflow.yaml`.
   - Move each workflow's templates into `src/preset/assets/workflows/<workflow-id>/templates/`.
   - Keep legacy `default/rules` and `default/sessions` only where init still needs them.

4. Make template rendering workflow-local.
   - Change `TemplateRenderer` to render from a supplied template root.
   - Reject absolute template paths, `..`, and resolved paths outside the selected workflow `templates/` directory.
   - Update includes to be workflow-template-local or reject unsupported cross-root includes.

5. Implement declarative variable resolution.
   - Keep engine built-ins for task, phase, context, and target branch values.
   - Apply workflow defaults, current phase defaults, then task variables.
   - Resolve default placeholders against already resolved/declarable variables.
   - Fail on circular defaults, unknown defaults, and unresolved required values.

6. Wire Core and CLI to `workflow`.
   - Update `PlaySpecCore`, prompt/phase/complete/rewind/status/current/list/specs commands, CLI utilities, and stores.
   - Update create command to support `playspec create "Title" --workflow mono-spec`.
   - Keep old positional create only as a compatibility shim during this change.

7. Add workflow CLI commands.
   - Add `src/cli/commands/workflow.ts`.
   - Implement `list`, `show`, `validate`, `install`, `remove`, and `export`.
   - Reject duplicate install ids unless the workflow is first removed.

8. Replace planning filename formulas.
   - Resolve planning context paths from workflow artifacts.
   - Update relevant file discovery to include resolved workflow artifacts.
   - Remove direct total-plan path formulas from `create.ts`.

9. Update tests.
   - Update existing task store, CLI, workflow loader, variable resolver, template renderer, relevant files, and init tests.
   - Add regression tests for template traversal, variable default unknown/cycle errors, workflow artifact path discovery, `--workflow` create, and workflow CLI commands.

## Old Paths To Close

- `task.workflowType` field reads/writes.
- `.playspec/workflows/<id>.yaml` runtime lookup.
- `.playspec/templates/<path>` runtime lookup.
- `create.ts` hardcoded `TOTAL_SPEC_FILE` and `PHASE_PLAN_FILE`.
- Tests asserting copied workflow/template runtime assets in `.playspec`.

## Tests To Run

- `pnpm build`
- `pnpm test`
- Focused retries if needed:
  - `pnpm test -- tests/unit/variable-resolver.test.ts`
  - `pnpm test -- tests/unit/template-renderer.test.ts`
  - `pnpm test -- tests/integration/workflow-loader.test.ts`
  - `pnpm test -- tests/integration/init-create-next.test.ts`

## Risks

- Broad rename from `workflowType` to `workflow` touches many tests and display commands.
- Existing fixtures may still contain `workflowType`; the implementation should read them only as legacy compatibility while writing new `workflow`.
- Workflow asset copying into `dist` must change so built-in workflow directories are available after build.
- `completion.validationTemplate` currently stores `.playspec/templates` style paths and needs a non-breaking display/reference update.

## Rollback Notes

This change should be one focused commit. If validation fails late, revert the commit rather than partially restoring `.playspec` runtime asset behavior.

## Completion Criteria

- New task YAML writes `workflow: <id>`.
- Prompt rendering uses selected workflow-local templates.
- Built-in workflows load from `src/preset/assets/workflows`.
- User workflows load from `~/.playspec/workflows`.
- Workflow commands are present and tested.
- Variable default resolution is ordered and fails clearly for unknown/circular/unresolved required variables.
- Artifact declarations drive relevant files and phase-execution planning context.
- `pnpm build` and `pnpm test` pass.
