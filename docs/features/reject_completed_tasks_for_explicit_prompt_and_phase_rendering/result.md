# Implementation Result

## Files Changed

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/spec.md`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/plan.md`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/result.md`

## Behavior Implemented

- `PlaySpecCore.renderNextPrompt()` now rejects non-active task records with `TaskNotActiveError` before context validation, workflow loading, phase resolution, or template rendering.
- `PlaySpecCore.renderExplicitPhasePrompt()` now rejects non-active task records with `TaskNotActiveError` before context validation, workflow loading, phase resolution, or template rendering.
- Explicit completed-task CLI prompt rendering now fails through the shared core guard for:
  - `playspec prompt --task <completed-task-id>`
  - `playspec next --task <completed-task-id>`
  - `playspec phase 1 --task <completed-task-id>`

## Verification Performed

- `pnpm test -- tests/cli.test.ts tests/integration/init-create-next.test.ts`
  - Passed: 221 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 488 tests.

## Remaining Risks

- Intentional re-rendering of executable prompts from completed tasks is now blocked. Historical/reference use cases need a read-only artifact or view path instead of active prompt rendering.
- Production `YamlTaskStore.getTask()` resolves active task storage only, so archived tasks usually fail before returning an archived record. Core coverage still verifies that if a `TaskStore` returns an archived record, the render helpers reject it with `TaskNotActiveError`.

## Refactor Review

- Compared the working diff against `origin/master`.
- `git diff --check` passed.
- No safe local refactor was applied. The production change is already the smallest shared-boundary edit: two calls to the existing `assertTaskIsActive()` helper.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/164
- Branch: `agent/issue-145-render-active-guard`
- Reusable agent guidance: not needed for this narrow lifecycle guard.
