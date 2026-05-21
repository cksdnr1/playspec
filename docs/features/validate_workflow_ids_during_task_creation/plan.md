# Validate Workflow IDs During Task Creation Plan

## Ordered Implementation Steps

1. Add workflow validation to `src/cli/commands/create.ts`.
   - Add a small helper near the create command implementation:
     - Input: `workspaceRoot`, `workflow`.
     - Behavior: `await new WorkflowLoader(workspaceRoot).resolve(workflow)`.
     - Output: none; let `WorkflowNotFoundError`, schema errors, template errors, or mismatch errors propagate.
   - Call the helper in `runCreate()` immediately after `.playspec` workspace existence is confirmed and before normal or phase-execution branches do any state-producing work.

2. Preserve normal create behavior.
   - Leave `src/cli/index.ts` option default `--workflow mono-spec` unchanged.
   - Leave source resolution, link resolution, `createNormalTask()`, task variable parsing, source file writing, and HEAD writing unchanged after validation succeeds.

3. Preserve phase-execution behavior.
   - Validate the requested new execution workflow before resolving planning context and before creating the execution task.
   - Leave planning artifact resolution unchanged; it should continue loading the completed planning task's workflow separately.

4. Add normal create regression tests in `tests/cli.test.ts`.
   - Unknown workflow:
     - Initialize a temp workspace.
     - Create a valid prior task so HEAD has a known value.
     - Run `create "Broken Workflow Demo" --workflow definitely-missing`.
     - Assert exit code is non-zero.
     - Assert stderr contains `Workflow file not found: definitely-missing` and a list/install hint substring.
     - Assert `.playspec/tasks/active/broken_workflow_demo` does not exist.
     - Assert `.playspec/HEAD` still contains the prior task ID.
   - Valid built-in workflow:
     - Keep the existing explicit `total-plan` create test, or add a HEAD/task assertion if needed.

5. Add phase-execution regression coverage.
   - Use the existing phase-execution setup style from `tests/integration/init-create-next.test.ts`.
   - Initialize workspace and create a completed `total-plan` planning task with required total-spec and phase-plan artifacts.
   - Set HEAD to a known prior task.
   - Run `create "Compatible Planning" --workflow definitely-missing --phase 2 --from <planningTaskId>`.
   - Assert exit code is non-zero.
   - Assert stderr contains workflow-not-found guidance.
   - Assert `.playspec/tasks/active/compatible_planning_phase_2_execution` does not exist.
   - Assert HEAD remains unchanged.

6. Run targeted validation first.
   - `pnpm test -- tests/cli.test.ts tests/integration/init-create-next.test.ts`

7. Run full repository validation.
   - `pnpm build`
   - `pnpm test`

## Files to Edit

- `src/cli/commands/create.ts`
  - Add and call workflow validation before task state writes.

- `tests/cli.test.ts`
  - Add unknown normal workflow rejection and HEAD preservation coverage.
  - Keep valid built-in workflow happy-path coverage.

- `tests/integration/init-create-next.test.ts`
  - Add unknown phase-execution workflow rejection coverage.

- `docs/features/validate_workflow_ids_during_task_creation/result.md`
  - To be written after implementation and validation.

- `docs/features/validate_workflow_ids_during_task_creation/pr.md`
  - To be written before PR creation.

## Old Paths, Bypasses, and Partial Migration Risks

- `YamlTaskStore.createTask()` remains a storage primitive and will still accept any workflow string when called directly. This is intentional and keeps storage decoupled from workflow loading.
- CLI `create` is the user-visible mutation path being fixed.
- Prompt rendering continues to validate task workflows through `WorkflowLoader` as before.
- Phase-execution creation has two workflow concerns:
  - The completed planning task workflow used to discover artifacts.
  - The new execution task workflow requested on the CLI.
  The fix must validate the new execution task workflow before state writes.

## State and User-Visible Behavior Chain

Unknown workflow:

`playspec create` -> `runCreate()` -> `WorkflowLoader.resolve()` -> `WorkflowRegistry.resolve()` -> `WorkflowNotFoundError` -> command exits non-zero -> no task YAML/source write -> no HEAD update -> user sees actionable error.

Valid workflow:

`playspec create` -> `runCreate()` -> `WorkflowLoader.resolve()` succeeds with project/user/built-in precedence -> existing create path writes task state -> HEAD updates -> user sees created task output.

## Risks

- Earlier validation also catches malformed workflow YAML or missing templates. This is consistent with prompt rendering and acceptable because such a task would not be usable.
- Tests should assert stable substrings rather than full stderr formatting to avoid coupling to chalk or error formatting.
- The command help hint in `WorkflowNotFoundError` references `playspec workflow list/install`, while this CLI help does not currently expose that command. The issue accepts existing or equivalent guidance, so the test should focus on the workflow-not-found message plus list/install hint keywords.

## Rollback Notes

- Revert the helper and call site in `src/cli/commands/create.ts`.
- Revert the added tests.
- No migration is needed because this change prevents future invalid state but does not alter existing task data.

## Completion Criteria

- Unknown normal create exits non-zero and leaves no new task directory.
- Unknown normal create leaves HEAD unchanged when HEAD already exists.
- Valid built-in workflow create still succeeds.
- Unknown phase-execution create exits non-zero before writing an execution task directory and leaves HEAD unchanged.
- Targeted tests pass.
- Full `pnpm build` and `pnpm test` pass.
