# Declarative Workflow Assets Result

## Behavior Implemented

- New task state writes `workflow` instead of `workflowType`.
- Historical task YAML with `workflowType` is read through a narrow compatibility fallback and rewritten as `workflow` on mutation.
- Built-in workflows load from `src/preset/assets/workflows/<workflow-id>/workflow.yaml`.
- User workflows resolve from `~/.playspec/workflows/<workflow-id>/workflow.yaml`, with test isolation via `PLAY_SPEC_USER_WORKFLOWS`.
- Workflow assets own `workflow.yaml`, `templates/`, local rules includes, variables, artifacts, phases, and routing.
- Templates render only from the selected workflow's `templates/` directory, with traversal and absolute path rejection.
- Variable resolution applies engine built-ins, workflow defaults, current phase defaults, and task variables.
- Unknown and circular variable defaults raise explicit errors.
- Workflow artifacts are included in relevant file discovery and phase-execution planning context.
- CLI creation supports `playspec create "Title" --workflow mono-spec` while preserving old two-positional compatibility.
- CLI workflow commands support `list`, `show`, `validate`, `install`, `remove`, and `export`.
- `playspec init` no longer copies workflow/template runtime assets into `.playspec`.

## Files Changed

- Core/task schema: `src/core/types.ts`, `src/core/schemas.ts`, `src/storage/yaml-task-store.ts`.
- Workflow runtime: `src/workflow/workflow-loader.ts`, `src/workflow/workflow-registry.ts`, `src/workflow/workflow-installer.ts`, `src/workflow/workflow-schema.ts`, `src/workflow/index.ts`.
- Rendering/variables: `src/template/template-renderer.ts`, `src/template/template-loader.ts`, `src/template/variable-resolver.ts`.
- Core flow/relevant files: `src/core/playspec-core.ts`, `src/core/relevant-files.ts`, `src/core/errors.ts`.
- CLI: `src/cli/index.ts`, `src/cli/commands/create.ts`, `src/cli/commands/workflow.ts`, plus command display/use sites updated from `workflowType` to `workflow`.
- Presets/assets: `src/preset/preset-manager.ts`, `src/preset/assets/workflows/**`.
- Tests: unit and integration coverage updated for the new task field, workflow-local assets, workflow CLI, template safety, artifacts, and variable default errors.

## Verification

- `pnpm build` passed.
- `pnpm test` passed: 17 test files, 277 tests.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/35

## Remaining Risks

- Old `.playspec/workflows` project overrides are intentionally no longer honored.
- Existing active tasks that still contain only `workflowType` are read-compatible, but new writes use `workflow`.
- User workflow install currently rejects/copies by filesystem behavior and does not support remote Git URLs or overwrite flags.
