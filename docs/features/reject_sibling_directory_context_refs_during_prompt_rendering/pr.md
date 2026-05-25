# Draft PR

Fixes #179

## Summary

- Added regression coverage for `renderExplicitPhasePrompt()` rejecting persisted sibling-prefix context refs that escape the workspace.
- Confirmed the existing `renderNextPrompt()` sibling-prefix regression remains covered.
- Recorded PlaySpec spec, plan, and result artifacts for issue #179.

## Changed Files

- `tests/integration/init-create-next.test.ts`
- `docs/features/reject_sibling_directory_context_refs_during_prompt_rendering/spec.md`
- `docs/features/reject_sibling_directory_context_refs_during_prompt_rendering/plan.md`
- `docs/features/reject_sibling_directory_context_refs_during_prompt_rendering/result.md`
- `docs/features/reject_sibling_directory_context_refs_during_prompt_rendering/pr.md`

## Tests Run

```sh
pnpm vitest run tests/integration/init-create-next.test.ts -t "sibling contextRef"
pnpm build
pnpm test
```

Post-change results:
- Targeted test: 2 passed, 49 skipped.
- Build: passed.
- Full suite: 508 passed.

## PlaySpec Task ID

`reject_sibling_directory_context_refs_during_prompt_rendering`

## Risk Notes

- Low risk. This is an integration-test coverage expansion for an existing shared guard.
- Production code already used separator-aware workspace containment on `origin/master`.
- No reusable agent guidance changes are needed; this issue follows existing PlaySpec workflow and repository testing conventions.
