Fixes #266

## Summary

- Stops `playspec specs --show-missing` from reporting issue-scope-create prompt metadata as missing file paths.
- Keeps declared issue-scope-create report artifacts visible when they are missing.
- Adds unit and CLI regression coverage for rendered prompt metadata and user-visible missing-path output.

## Why This PR

`issue-scope-create` prompts backtick non-file metadata such as target repositories, task titles, and focus-area prose. Relevant-file discovery treated slash-containing backticked values as path candidates, which made `specs --show-missing` report values like `cksdnr1/playspec` and comma-separated focus descriptions as missing files.

## Problem

Rendered prompt discovery used broad path heuristics for every backticked token. Required workflow variables could also turn slash-containing metadata into workflow file candidates. This made missing-file evidence noisy and reduced confidence in the artifact paths reported by `specs --show-missing`.

## How It Was Fixed

- `src/core/relevant-files.ts`
  - Adds strict rendered prompt backtick parsing that rejects whitespace, commas, non-path characters, and owner/repo-style values without file extensions.
  - Keeps the existing broad backtick parser for structured context list variables.
  - Restricts required-variable file candidates to path-named variables (`_FILE`, `_PATH`, `_DOC`), so metadata variables do not bypass rendered prompt filtering.
- `tests/unit/relevant-files.test.ts`
  - Adds an issue-scope-create-like `discoverRelevantFiles()` regression covering metadata values, report artifacts, and a normal rendered workspace path.
- `tests/cli.test.ts`
  - Adds `specs --show-missing --path-only` coverage proving missing report artifacts remain and metadata values are excluded from user-visible missing output.

## Changed Files

- `src/core/relevant-files.ts`
- `tests/unit/relevant-files.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_266_avoid_prompt_metadata/spec.md`
- `docs/features/issue_266_avoid_prompt_metadata/plan.md`
- `docs/features/issue_266_avoid_prompt_metadata/result.md`
- `docs/features/issue_266_avoid_prompt_metadata/pr.md`

## Validation

- Passed: `pnpm exec vitest run tests/unit/relevant-files.test.ts`
- Passed: `pnpm exec vitest run tests/cli.test.ts -t 'issue-scope-create prompt metadata|reports missing specs paths'`
- Passed: `pnpm build`
- Passed: `pnpm test`

## PlaySpec Task

- `issue_266_avoid_prompt_metadata_missing_files`

## Risks / Follow-Ups

- Rendered prompt discovery is intentionally conservative and now requires file-like extensions for rendered backtick paths. Extensionless files mentioned only in rendered prompts will not be discovered through this heuristic.
- Structured workflow artifacts and outputs still report missing issue-scope-create files independently of rendered prompt parsing.
- No reusable agent guidance change is needed; this is a localized parser and regression-test fix.
