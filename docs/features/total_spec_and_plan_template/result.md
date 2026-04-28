# Total Spec And Plan Template - Implementation Result

## Files Changed

- `src/template/variable-resolver.ts`
  - Added `TOTAL_SPEC_FILE` and `PHASE_PLAN_FILE` resolved variables.
  - Defaults now match phase-execution context linking:
    - `docs/features/<featureSlug>/<featureSlug>_total_spec.md`
    - `docs/features/<featureSlug>/<featureSlug>_phase_plan.md`
  - Existing `SPEC_FILE`, `PLAN_FILE`, `RESULT_FILE`, `PR_FILE`, `MASTER_SPEC_FILE`, and other legacy variables are preserved.

- `src/preset/assets/default/workflows/total-plan.yaml`
  - Added the seven-phase `total-plan` workflow:
    - `total_spec_draft`
    - `total_spec_validate`
    - `total_spec_patch`
    - `phase_plan_create`
    - `phase_plan_validate`
    - `phase_plan_patch`
    - `final_review`
  - Added gated validation routing:
    - total spec `approved` -> `phase_plan_create`
    - total spec `needs_revision` -> `total_spec_patch`
    - phase plan `approved` -> `final_review`
    - phase plan `needs_revision` -> `phase_plan_patch`
  - Added workflow outputs for total spec, phase plan, and final result discovery.

- `src/preset/assets/default/templates/total-plan/*.md`
  - Added English prompts for all seven planning phases.
  - Prompts use `TOTAL_SPEC_FILE` and `PHASE_PLAN_FILE` as authoritative planning outputs.
  - Validation prompts require a readiness score and state:
    - `approved` only when score is `>= 95` and no blockers remain.
    - `needs_revision` when score is below `95` or blockers remain.
  - `final_review` writes `RESULT_FILE` and explicitly avoids implementation, child task creation, PR, viewer, migration, archive, rollback, and MCP work.

- Tests updated:
  - `tests/unit/variable-resolver.test.ts`
  - `tests/integration/workflow-loader.test.ts`
  - `tests/integration/init-create-next.test.ts`
  - `tests/cli.test.ts`

## Behavior Implemented

- Fresh default preset initialization now includes the `total-plan` workflow and templates.
- `PlaySpecCore.renderNextPrompt()` can render total planning prompts through the same workflow/template path used by existing workflows.
- No-source planning tasks render `(not provided)` and `(none)` context values and instruct the agent to start from `TASK_TITLE` plus current repository code.
- The deprecated `playspec next` path and canonical `playspec prompt` path both render the new workflow through shared rendering.
- Phase-execution task creation remains unchanged, but total-plan output variables now align with the filenames it already requires.
- The planning workflow stops at `final_review`; it does not continue into implementation/test/refactor/PR phases.

## Verification Performed

- `pnpm vitest run tests/unit/variable-resolver.test.ts`
  - Passed: 13 tests.
- `pnpm vitest run tests/integration/workflow-loader.test.ts tests/integration/init-create-next.test.ts`
  - Passed: 19 tests.
- `pnpm vitest run tests/cli.test.ts`
  - Passed: 93 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 17 test files, 239 tests.

Post-implementation checks:

- `spec_verifier` reported no remaining code/spec gaps against `spec.md`.
- `refactor_guard` reported the implementation scope as allowed.
- `build_validator` reported `pnpm exec tsc --noEmit` success, but observed intermittent CLI test timeouts in its own `pnpm test` and CLI-file reruns. A later local full-suite `pnpm test` completed successfully.

## Remaining Risks

- `docs/features/total_spec_and_plan_template/plan.md` is still not present in the repository, even though the task listed it as a source of truth. Implementation followed `spec.md`, whose "File-By-File Plan" section contains the approved plan content.
- Existing workspaces do not receive new default preset assets automatically. Users need fresh `playspec init --preset default`, explicit re-init, or manual asset copy.
- The 95 readiness threshold is prompt policy only. The engine validates result labels and routing, but it does not parse or enforce numeric scores.
- CLI tests showed intermittent timeout behavior in the build validator's independent run, although the focused and final full-suite runs passed locally.
