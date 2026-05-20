# Scoped Issue Discovery — {{TASK_TITLE}}

**Task:** `{{TASK_ID}}`
**Target repository:** `{{TARGET_REPOSITORY}}`
**Issue scope:** `{{ISSUE_SCOPE}}`
**Focus area:** `{{FOCUS_AREA}}`
**Maximum issues:** `{{MAX_ISSUES}}`
**Issue label:** `{{ISSUE_LABEL}}`

## Goal

Inspect the target repository and find concrete, actionable, non-duplicate problems inside the user-provided scope.

The objective is to produce up to `{{MAX_ISSUES}}` accepted non-duplicate candidates. If a candidate is rejected as a duplicate, continue looking for another candidate in the same scope instead of ending the run. Stop only when `{{MAX_ISSUES}}` non-duplicate candidates have been accepted or the relevant scope has been exhausted and the evidence explains why no more candidates qualify.

This workflow creates GitHub issues. It must not implement code, edit target repository behavior, open pull requests, or create broad roadmap issues.

## Scope Contract

In scope:

- Problems directly tied to `{{ISSUE_SCOPE}}`.
- Problems in or near `{{FOCUS_AREA}}`.
- Issues that can be assigned to an implementer with clear acceptance criteria and tests.
- Issues backed by repository evidence such as files, commands, logs, failing tests, configuration, or docs.

Out of scope:

{{OUT_OF_SCOPE_RULES}}

Reject a candidate if it depends on out-of-scope work, requires a broad redesign, mixes unrelated problems, or cannot be verified from repository evidence.

## Duplicate Search

Before accepting each candidate, search existing issues using:

```bash
gh issue list --repo {{TARGET_REPOSITORY}} --search "{{DUPLICATE_SEARCH_QUERY}} <candidate keywords>" --state all
```

Also search local docs and issue references when available. If a likely duplicate exists, do not create a new candidate from it. Record the duplicate reference in `{{DISCOVERY_FILE}}`, then continue searching for a replacement candidate until the accepted candidate count reaches `{{MAX_ISSUES}}` or no concrete scoped candidates remain.

## Candidate Quality Bar

Accept a candidate only when all are true:

- The problem is concrete and observed in the repository.
- The problem belongs to the provided scope and focus area.
- The issue can be fixed without implementing unrelated scope.
- The acceptance criteria are testable.
- The duplicate search did not find an existing issue that substantially covers it.
- The issue body can be written in the PlaySpec-ready format required below.

Keep candidates narrow. Prefer zero issues over broad or speculative issues, but do not stop at zero merely because the first candidates were duplicates. Exhaust the configured focus area enough to show that every plausible candidate was duplicate, out of scope, too broad, or not actionable.

## Replacement Search Requirement

When a candidate is rejected, continue with another targeted search path before concluding the run:

- If rejected as duplicate, inspect neighboring files, tests, configuration, recent TODO/FIXME comments, failing or skipped tests, stale documentation, and related local issue artifacts inside `{{FOCUS_AREA}}`.
- If rejected as out of scope, narrow the next search back to `{{ISSUE_SCOPE}}` and `{{FOCUS_AREA}}`.
- If rejected as too broad, split it into smaller concrete candidates and run duplicate search for each smaller candidate.
- Do not reuse the same duplicate search terms only. Add candidate-specific keywords from file names, function names, warning/error text, or test names.
- Continue until `{{MAX_ISSUES}}` accepted candidates are written or the discovery report documents that the scoped evidence was exhausted.

## Required Issue Format

Every accepted candidate in `{{CANDIDATE_ISSUES_FILE}}` must use exactly these sections:

```markdown
## Problem

## Context

## Impact

## Scope

## Out of scope

## Acceptance criteria

## Test requirements

## Risk notes

## Recommended workflow
```

## Write Artifacts

Write `{{DISCOVERY_FILE}}` with this structure:

```markdown
# Scoped Issue Discovery

## Inputs
- Target repository: {{TARGET_REPOSITORY}}
- Issue scope: {{ISSUE_SCOPE}}
- Focus area: {{FOCUS_AREA}}
- Out of scope: {{OUT_OF_SCOPE_RULES}}
- Duplicate search query: {{DUPLICATE_SEARCH_QUERY}}
- Maximum issues: {{MAX_ISSUES}}

## Evidence Checked
- Files, commands, docs, tests, logs, or issue searches inspected.

## Duplicate Search Results
- Candidate keyword:
- Query:
- Result:
- Decision:

## Rejected Candidates
- Candidate:
- Reason rejected:
- Replacement search performed:
- Replacement outcome:

## Accepted Candidates
- Title:
- Evidence:
- Why concrete:
- Why non-duplicate:
```

Write `{{CANDIDATE_ISSUES_FILE}}` with one issue draft per accepted candidate:

```markdown
# Candidate Issues

## Candidate 1: <GitHub issue title>

## Problem
...

## Context
...

## Impact
...

## Scope
...

## Out of scope
...

## Acceptance criteria
...

## Test requirements
...

## Risk notes
...

## Recommended workflow
...
```

If no candidates qualify, write:

```markdown
# Candidate Issues

No scoped, actionable, non-duplicate issues found.
```

## Completion

After writing the artifacts:

- Run `playspec complete --result candidates_found` only if at least one issue should be created.
- Run `playspec complete --result no_issues` if no issue qualifies.
