# PR Draft

Fixes #145

## Summary

- Add the existing `TaskNotActiveError` core guard to `PlaySpecCore.renderNextPrompt()`.
- Add the same core guard to `PlaySpecCore.renderExplicitPhasePrompt()`.
- Add CLI regressions for explicit completed tasks through `prompt`, deprecated `next`, and render-only `phase`.
- Add core integration coverage for completed and archived task records.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/spec.md`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/plan.md`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/result.md`
- `docs/features/reject_completed_tasks_for_explicit_prompt_and_phase_rendering/pr.md`

## Tests Run

- `pnpm test -- tests/cli.test.ts tests/integration/init-create-next.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `reject_completed_tasks_for_explicit_prompt_and_phase_rendering`

## Risk Notes

- Completed tasks can no longer be used to re-render executable prompts for reference. That is intentional for active workflow rendering; read-only historical reference should use artifact/view surfaces instead.
- Archived tasks usually do not resolve through `YamlTaskStore.getTask()`, but the core guard now also rejects archived task records if a `TaskStore` returns one.

## Reusable Agent Guidance

- No new reusable agent guidance is needed. This is a narrow lifecycle guard using existing core ownership and error patterns.
