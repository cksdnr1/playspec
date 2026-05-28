# Implementation Result

## Behavior Implemented

- Rendered prompt backtick discovery now uses a stricter candidate filter before adding `rendered-prompt` relevant-file candidates.
- Backticked rendered-prompt values with whitespace or commas are ignored before normalization, so task titles and comma-separated focus-area prose are not reported as missing files.
- Backticked owner/repo-style values without a file extension, such as `cksdnr1/playspec`, are ignored.
- Required workflow variables now only contribute workflow file candidates when the variable name is path-shaped (`_FILE`, `_PATH`, or `_DOC`), preventing metadata variables like `TARGET_REPOSITORY` and `FOCUS_AREA` from bypassing the rendered prompt filter.
- Structured workflow outputs, workflow artifacts, path variables, context refs, task sources, and project docs remain on their existing discovery paths.

## Files Changed

- `src/core/relevant-files.ts`
  - Added strict rendered prompt backtick parsing.
  - Restricted required-variable path candidate collection to path-named variables.
- `tests/unit/relevant-files.test.ts`
  - Added issue-scope-create-like coverage proving metadata is ignored while real artifact paths and common workspace paths are preserved.
- `tests/cli.test.ts`
  - Added user-visible `specs --show-missing --path-only` regression coverage for an issue-scope-create task.
- `docs/features/issue_266_avoid_prompt_metadata/spec.md`
- `docs/features/issue_266_avoid_prompt_metadata/plan.md`
- `docs/features/issue_266_avoid_prompt_metadata/result.md`

## Verification

Passed:

- `pnpm exec vitest run tests/unit/relevant-files.test.ts`
- `pnpm exec vitest run tests/cli.test.ts -t 'issue-scope-create prompt metadata|reports missing specs paths'`
- `pnpm build`
- `pnpm test`

## Tests Changed

- `tests/unit/relevant-files.test.ts` covers `discoverRelevantFiles()` with issue-scope-create-like rendered prompt content, including repository metadata, task title metadata, comma-separated focus prose, report artifacts, and a normal workspace-relative rendered prompt path.
- `tests/cli.test.ts` covers the user-visible `specs --show-missing --path-only` output for an issue-scope-create task and asserts the missing report artifacts remain while metadata values are absent.

Failures encountered and fixed:

- The first unit run showed `TARGET_REPOSITORY` still appeared via required workflow variable discovery, not rendered prompt discovery. The implementation now restricts required-variable file candidates to path-named variables.
- The first CLI run exited with no existing relevant files in the fixture. The test now seeds a source problem through `--stdin`, matching a real task with an existing task source while keeping all report artifacts missing.

## Remaining Risks

- The rendered prompt filter is intentionally conservative and requires file-like extensions. That matches the issue acceptance criteria and avoids noisy prose metadata, but extensionless files mentioned only in rendered prompt backticks will not be discovered through this path.
- Structured workflow declarations still report artifact paths independently, so issue-scope-create report artifacts are not dependent on rendered prompt parsing.

## Refactor Review

- Ran `git diff --check`; no whitespace or patch formatting issues were found.
- Reviewed the diff against `origin/master`; no additional refactor was needed beyond the localized parser split.
- Intentionally skipped broader relevant-file discovery redesign and workflow/template edits because they are outside the issue scope.

## PR Preparation

- PR body source written to `docs/features/issue_266_avoid_prompt_metadata/pr.md`.
- Reusable agent guidance: no AGENTS.md or workflow guidance update is needed because the change is a localized parser/test fix, not a recurring operator rule.
- PR link: pending branch push and draft PR creation.
