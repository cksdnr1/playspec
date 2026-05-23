Fixes #146

## Summary

- Preserve first-visit completion artifact filenames for compatibility.
- Add `_visitN` suffixes for repeated routed completion snapshot and evidence files.
- Add regression coverage for repeated routed validation completion artifacts, first-visit preservation, and latest rollback snapshot references.

## Changed files

- `src/core/playspec-core.ts`
- `tests/integration/routing.test.ts`
- `docs/features/issue-146-per-visit-artifacts/spec.md`
- `docs/features/issue-146-per-visit-artifacts/plan.md`
- `docs/features/issue-146-per-visit-artifacts/result.md`
- `docs/features/issue-146-per-visit-artifacts/pr.md`

## Tests run

- `pnpm vitest run tests/integration/routing.test.ts tests/integration/completion-engine.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec task id

`preserve_per_visit_snapshots_and_evidence_for_repeated_routed_phase_completions`

## Risk notes

- Repeated routed visits now use new filenames from the second visit onward. First visits and non-routed completions retain existing paths.
