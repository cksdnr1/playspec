# Draft PR Body

PR: https://github.com/cksdnr1/playspec/pull/222

Fixes #221

## Summary

- Protect reserved resolver metadata from task-supplied variable collisions.
- Ensure workflow defaults referencing reserved phase metadata resolve from the actual active task and phase.
- Add regression coverage for direct metadata spoofing and default interpolation spoofing while preserving non-reserved task overrides.

## Changed Files

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_221_reserved_engine_phase_metadata/spec.md`
- `docs/features/issue_221_reserved_engine_phase_metadata/plan.md`
- `docs/features/issue_221_reserved_engine_phase_metadata/result.md`
- `docs/features/issue_221_reserved_engine_phase_metadata/pr.md`

## Tests Run

- `pnpm vitest run tests/unit/variable-resolver.test.ts`
- `pnpm build`
- `pnpm test`
- `git diff --check`

## PlaySpec Task

- `issue_221_reserved_engine_phase_metadata`

## Risk Notes

- Existing tasks that contain reserved-name variables now have those collisions ignored by the resolver.
- Future resolver-provided metadata keys should be added to the reserved set if they need the same protection.

## Reusable Agent Guidance

No reusable agent guidance update is needed. This fix is a narrow resolver precedence contract, covered by focused regression tests.
