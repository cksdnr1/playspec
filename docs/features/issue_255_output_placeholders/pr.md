# Draft PR Body

Fixes #255

## Summary

- Parse placeholders inside phase `outputs` when computing demanded workflow variables.
- Preserve existing bare output-name demand behavior.
- Add resolver regression tests for output-only defaults, unknown output dependency failures, literal output paths, and multiple placeholders.

## Changed Files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_255_output_placeholders/spec.md`
- `docs/features/issue_255_output_placeholders/plan.md`
- `docs/features/issue_255_output_placeholders/result.md`
- `docs/features/issue_255_output_placeholders/pr.md`

## Tests Run

- `pnpm test -- tests/unit/variable-resolver.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

`issue_255_output_placeholders`

## Risk Notes

- Low risk: change is isolated to resolver demand calculation and uses the existing placeholder syntax already used by declaration defaults.
- Bare output names are still demanded for backward compatibility.

## Reusable Agent Guidance

No reusable agent guidance update is needed. The fix is a local resolver behavior correction covered by regression tests.
