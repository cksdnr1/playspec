# Issue Scope Create Workflow Spec

## Problem

PlaySpec has a workflow for validating existing issues, but it does not provide a separate workflow for creating new scoped GitHub issues after inspecting a repository. Agents need a safe workflow that stays inside a user-provided scope, avoids duplicate issues, and creates only concrete PlaySpec-ready issues.

## Goals

- Add a standalone built-in workflow named `issue-scope-create`.
- Accept target repository, scope, focus area, out-of-scope rules, duplicate-search query, and maximum issue count.
- Keep repository inspection read-only until the explicit issue creation phase.
- Require PlaySpec-ready issue bodies.
- Document how to run the workflow.
- Add tests proving the workflow is discoverable and structurally separate from `issue-validate`.

## Non-Goals

- Do not change `issue-validate`.
- Do not implement target repository fixes.
- Do not automate duplicate detection beyond workflow instructions.
- Do not add GitHub API client code to PlaySpec.

## Design

The workflow has two phases:

1. `scoped_issue_discovery`: inspect the target repository, search for duplicates, reject broad or duplicate candidates, and write candidate issue drafts.
2. `create_scoped_issues`: re-check duplicates and create at most `MAX_ISSUES` GitHub issues using `gh issue create`.

The first phase routes with `candidates_found` or `no_issues`. The second phase always writes a final creation report, even when zero issues are created.
