# Create Scoped GitHub Issues — {{TASK_TITLE}}

**Task:** `{{TASK_ID}}`
**Target repository:** `{{TARGET_REPOSITORY}}`
**Issue scope:** `{{ISSUE_SCOPE}}`
**Focus area:** `{{FOCUS_AREA}}`
**Candidate file:** `{{CANDIDATE_ISSUES_FILE}}`

## Goal

Create GitHub issues only for the accepted candidates from `{{CANDIDATE_ISSUES_FILE}}`.

Do not implement code in the target repository. Do not edit files in the target repository. Do not create branches, commits, or pull requests.

## Before Creating Issues

For each candidate:

1. Re-read `{{DISCOVERY_FILE}}` and `{{CANDIDATE_ISSUES_FILE}}`.
2. Confirm the candidate still satisfies the scope contract:
   - It is inside `{{ISSUE_SCOPE}}`.
   - It is focused on `{{FOCUS_AREA}}`.
   - It does not violate: `{{OUT_OF_SCOPE_RULES}}`.
   - It is concrete and actionable.
   - It is not a duplicate.
3. Re-run duplicate search immediately before creating:

```bash
gh issue list --repo {{TARGET_REPOSITORY}} --search "{{DUPLICATE_SEARCH_QUERY}} <candidate keywords>" --state all
```

Skip the candidate if the duplicate search now finds a substantially matching issue.

## Creation Rules

- Create at most `{{MAX_ISSUES}}` issues.
- Use `gh issue create --repo {{TARGET_REPOSITORY}}`.
- The GitHub issue body must preserve the PlaySpec-ready issue sections:
  - Problem
  - Context
  - Impact
  - Scope
  - Out of scope
  - Acceptance criteria
  - Test requirements
  - Risk notes
  - Recommended workflow
- Do not create placeholder, umbrella, roadmap, or investigation-only issues.
- If a candidate needs more research before it is actionable, skip it and record the reason.

## Write Final Report

Write `{{CREATED_ISSUES_FILE}}`:

```markdown
# Created Scoped Issues

## Summary
- Target repository: {{TARGET_REPOSITORY}}
- Issue scope: {{ISSUE_SCOPE}}
- Focus area: {{FOCUS_AREA}}
- Created: <count>
- Skipped as duplicate: <count>
- Skipped as too broad or not actionable: <count>

## Created Issues
- <issue url> — <title>

## Skipped Candidates
- <title> — <reason>

## Commands Run
- `gh issue list ...`
- `gh issue create ...`
```

If no issues were created, `Created: 0` is valid. Explain why.

## Completion

After writing `{{CREATED_ISSUES_FILE}}`, run:

```bash
playspec complete
```
