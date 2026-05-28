# Implementation Plan

## Ordered Steps

1. Update rendered prompt backtick filtering in `src/core/relevant-files.ts`.
   - Keep existing broad backtick parsing for structured context list variables.
   - Add a stricter rendered-prompt parser/helper for `rendered-prompt` candidates.
   - Reject rendered backtick candidates that contain whitespace or commas.
   - Reject rendered backtick candidates with characters outside normal workspace-relative path syntax.
   - Reject `owner/repo` metadata by requiring a recognized workspace path root or a final segment with an extension.
   - Preserve current final validation through `invalidPathReason()` and `normalizeCandidates()`.

2. Add focused unit coverage in `tests/unit/relevant-files.test.ts`.
   - Use an issue-scope-create-like workflow/template fixture.
   - Include backticked metadata:
     - `cksdnr1/playspec`
     - `Hourly issue discovery: cksdnr1/playspec (20260528T221959Z)`
     - `src/core, src/template, src/workflow, docs/features, tests/integration`
   - Include backticked artifact paths:
     - `docs/issues/scope-create/hourly_issue_discovery_cksdnr1_playspec_20260528t221959z/discovery.md`
     - `docs/issues/scope-create/hourly_issue_discovery_cksdnr1_playspec_20260528t221959z/candidate_issues.md`
     - `docs/issues/scope-create/hourly_issue_discovery_cksdnr1_playspec_20260528t221959z/created_issues.md`
   - Assert metadata is not emitted as candidates and artifact paths are emitted.
   - Keep/confirm existing `docs/features/feature_x/from_prompt.md` rendered prompt discovery still passes.

3. Add narrow CLI coverage if practical in `tests/cli.test.ts`.
   - Create an `issue-scope-create` task with repository, title-like scope, and comma-separated focus area variables.
   - Run `specs --show-missing --path-only`.
   - Assert stderr missing list includes the three report artifact paths and excludes metadata values.
   - Keep stdout path-only behavior script-safe.

4. Run focused validation.
   - `pnpm exec vitest run tests/unit/relevant-files.test.ts`
   - Any touched CLI test target, likely `pnpm exec vitest run tests/cli.test.ts -t "issue-scope-create"`
   - `pnpm build`

5. Write implementation result artifacts.
   - `docs/features/issue_266_avoid_prompt_metadata/result.md`
   - `docs/features/issue_266_avoid_prompt_metadata/pr.md`

## Files To Edit

- `src/core/relevant-files.ts`
- `tests/unit/relevant-files.test.ts`
- `tests/cli.test.ts` if CLI fixture setup remains narrow
- `docs/features/issue_266_avoid_prompt_metadata/result.md`
- `docs/features/issue_266_avoid_prompt_metadata/pr.md`

## Tests To Add Or Update

- Unit test: issue-scope-create-like rendered prompt rejects metadata and keeps report artifact paths.
- CLI test: user-visible `specs --show-missing --path-only` excludes metadata and reports report artifacts, if feasible without broad fixture churn.

## Risks

- Filtering too aggressively could drop legitimate rendered prompt paths without extensions. Mitigate by allowing common workspace roots and by preserving existing rendered prompt path tests.
- Changing the shared parser could alter `CONTEXT_FILES` and `CONTEXT_REFS_DETAIL` behavior. Mitigate by using a separate strict parser only for rendered prompt discovery.
- CLI `--path-only` writes missing paths to stderr by design; tests must assert stderr for missing expected files and stdout for existing files.

## Rollback Notes

The implementation is localized. Rollback is a normal git revert of changes to `src/core/relevant-files.ts`, focused tests, and task docs. No migration or persisted data rewrite is involved.

## Completion Criteria

- `discoverRelevantFiles()` no longer returns rendered-prompt candidates for issue-scope-create metadata with spaces, commas, or owner/repo form.
- Missing issue-scope-create `DISCOVERY_FILE`, `CANDIDATE_ISSUES_FILE`, and `CREATED_ISSUES_FILE` still appear.
- Existing rendered prompt discovery of real workspace-relative paths still passes.
- Focused unit and touched CLI/build validations pass.
