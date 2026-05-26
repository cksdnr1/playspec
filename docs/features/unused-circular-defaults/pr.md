Fixes #237

## Summary

- Defers unused workflow-level circular defaults instead of failing unrelated active phase variable resolution.
- Keeps demanded circular default chains strict with `CircularVariableDefaultError`.
- Adds focused unit coverage for an unused `A -> B -> A` workflow default cycle.

## Why this PR

Workflow authors can define defaults for later or optional phases. Before this change, a circular default in unused workflow variables could make an unrelated active phase fail before its own required variables and prompt needs were evaluated.

## Problem

`resolveDeclaredDefaults()` already deferred unknown dependency errors for non-demanded defaults, but it allowed `CircularVariableDefaultError` to escape while iterating every declaration. That meant an active phase requiring only `FEATURE_SLUG` could fail because unused variables `A: "{{B}}"` and `B: "{{A}}"` existed elsewhere in the workflow.

## How it was fixed

- `src/template/variable-resolver.ts`: extends the non-demanded default deferral path to include `CircularVariableDefaultError`.
- `src/template/variable-resolver.ts`: only defers these errors at the root default being resolved, so nested failures bubble up and do not partially resolve the root as an empty string.
- `tests/unit/variable-resolver.test.ts`: adds regression coverage for an unused workflow-level `A -> B -> A` cycle while keeping existing demanded-cycle coverage intact.

## Changed files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/unused-circular-defaults/spec.md`
- `docs/features/unused-circular-defaults/plan.md`
- `docs/features/unused-circular-defaults/result.md`
- `docs/features/unused-circular-defaults/pr.md`

## Validation

- `pnpm test -- tests/unit/variable-resolver.test.ts` before resolver fix: failed with `CircularVariableDefaultError` for `unused-cycle: A -> B -> A`.
- `pnpm test -- tests/unit/variable-resolver.test.ts` after resolver fix: passed, 30 tests.
- `pnpm build`: passed.
- `pnpm test`: passed, 30 test files and 606 tests.

Skipped checks: none.

## PlaySpec task

- `issue_237_unused_circular_workflow_defaults`

## Risks / follow-ups

- Risk is low: the suppression remains demand-aware and demanded cycles still throw.
- No reusable agent guidance change is needed; this was a focused resolver bug fix.
