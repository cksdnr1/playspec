# PR Notes

Fixes #162

## Summary

- Confirmed prompt rendering already uses the strict workspace boundary check shared with `addContextRef()`.
- Added focused integration coverage showing explicit archived workspace-relative context refs under `.playspec/tasks/archived/...` still render in compact, strict, and full prompt context modes.
- Kept production code unchanged because the sibling-prefix rejection behavior is already present on `origin/master`.

## Changed Files

- `tests/integration/init-create-next.test.ts`
- `docs/features/reject_sibling_prefix_contextrefs_during_prompt_rendering/spec.md`
- `docs/features/reject_sibling_prefix_contextrefs_during_prompt_rendering/plan.md`
- `docs/features/reject_sibling_prefix_contextrefs_during_prompt_rendering/result.md`
- `docs/features/reject_sibling_prefix_contextrefs_during_prompt_rendering/pr.md`

## Tests Run

- `pnpm test -- --run tests/integration/init-create-next.test.ts -t "contextRef|context refs|context modes|archived"`
- `pnpm build`
- `pnpm test -- --run tests/integration/init-create-next.test.ts`

## PlaySpec Task

- `reject_sibling_prefix_contextrefs_during_prompt_rendering`

## Risk Notes

- Low risk. The code change is test-only.
- Reusable agent guidance: no new guidance is needed; this reinforces existing workspace-boundary and prompt-rendering test expectations.
