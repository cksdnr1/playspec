# PR: Issue 82 Lightweight Task Links Planning

## Summary

This PR turns GitHub issue #82, "PlaySpec Lightweight Task Links Technical Spec", into a PlaySpec total-plan style planning package.

It is documentation/planning only. It does not implement task links or change runtime behavior.

## Docs Added

- `docs/features/issue_82_lightweight_task_links/spec.md`
- `docs/features/issue_82_lightweight_task_links/plan.md`
- `docs/features/issue_82_lightweight_task_links/result.md`
- `docs/features/issue_82_lightweight_task_links/pr.md`

## What The Plan Covers

- Optional task links with `parent`, `after`, and `related`.
- `playspec create --parent` and `playspec create --after`.
- No `--related` on create in v1.
- `playspec link` and `playspec unlink`.
- Current/head task source shorthand with `--to`.
- Exact then unique-prefix task ID resolution.
- Duplicate no-op warnings and self-link rejection.
- Direct-only status rendering for parents, after links, related links, includes, and followed-by.
- Simple suggested-next behavior for parent tasks.
- Compact linked-task context in prompt rendering.
- Compatibility with existing tasks and workflows.

## Validation

- Diff reviewed against `origin/master`.
- Expected diff is limited to Markdown files under `docs/features/issue_82_lightweight_task_links/`.
- No source, test, package, lockfile, dist, or runtime files are changed.

## Issue

Planning PR for #82.

Future implementation PR should close #82 after the v1 behavior is implemented and validated.
