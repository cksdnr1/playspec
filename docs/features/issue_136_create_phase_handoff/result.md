# Issue 136 Create Phase Handoff Result

## Files Changed

- `src/cli/commands/create.ts`
- `src/core/types.ts`
- `src/storage/yaml-task-store.ts`
- `src/preset/assets/workflows/phase-execution/templates/phase_template.md`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_136_create_phase_handoff/spec.md`
- `docs/features/issue_136_create_phase_handoff/plan.md`
- `docs/features/issue_136_create_phase_handoff/result.md`

## Behavior Implemented

- `CreateTaskInput` now supports an optional `currentPhase` for callers that need an initial phase.
- `YamlTaskStore.createTask()` persists that initial phase when provided and keeps `currentPhase: null` as the default for normal task creation.
- `playspec create ... --phase <n> --from <planningTaskId>` now stores the requested phase as `currentPhase` when the selected workflow declares that phase.
- `phase-execution` handoff tasks now receive planning-derived `FEATURE_SLUG` unless explicitly overridden by `--var FEATURE_SLUG=...`.
- The phase-execution prompt now renders the resolved phase spec and handoff file paths so the planning-derived variables are visible in the generated prompt.
- Legacy non-phase workflows using `--phase` keep previous behavior when they do not declare the requested phase or `FEATURE_SLUG`.

## Verification Performed

- `pnpm vitest run tests/integration/init-create-next.test.ts tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/163
- Reusable agent guidance: no new guidance is needed; the existing repository instructions covered the workflow and module boundaries.

## Refactor Review

No additional refactor was applied. The final diff is already limited to the task creation contract, handoff CLI path, phase-execution prompt visibility, and the focused integration regression.

## Remaining Risks

- Existing tasks are not migrated. This is intentional; the fix applies to newly created handoff tasks.
- Non-`phase-execution` workflows with numeric phase ids and `FEATURE_SLUG` now receive the same handoff improvements. That follows the existing `--phase` handoff path while preserving workflows that do not declare those fields.
