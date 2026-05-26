# Create Scoped GitHub Issues — {{TASK_TITLE}}

**Task:** `{{TASK_ID}}`
**Target repository:** `{{TARGET_REPOSITORY}}`
**Issue scope:** `{{ISSUE_SCOPE}}`
**Focus area:** `{{FOCUS_AREA}}`
**Issue label:** `{{ISSUE_LABEL}}`
**Candidate file:** `{{CANDIDATE_ISSUES_FILE}}`

## Goal

Create GitHub issues only for the accepted candidates from `{{CANDIDATE_ISSUES_FILE}}`.

Do not implement code in the target repository. Do not edit files in the target repository except declared workflow report artifacts: `{{DISCOVERY_FILE}}`, `{{CANDIDATE_ISSUES_FILE}}`, and `{{CREATED_ISSUES_FILE}}`. Do not create branches, commits, or pull requests.

Writing `{{DISCOVERY_FILE}}`, `{{CANDIDATE_ISSUES_FILE}}`, or `{{CREATED_ISSUES_FILE}}` is not enough when candidates qualify. Those files are evidence and reporting artifacts. The final output of this phase is actual GitHub issues created with `gh issue create`.

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

Skip the candidate if the duplicate search now finds a substantially matching issue, then continue with the next accepted candidate. If fewer than `{{MAX_ISSUES}}` issues are created because one or more candidates became duplicates at final check time, run one additional focused replacement search inside `{{ISSUE_SCOPE}}` and `{{FOCUS_AREA}}` before writing the final report. Create a replacement issue only if it satisfies the same quality bar and duplicate search rules.

## Creation Rules

- Create at most `{{MAX_ISSUES}}` issues.
- Use `gh issue create --repo {{TARGET_REPOSITORY}} --label {{ISSUE_LABEL}}`.
- Every created issue must include the `{{ISSUE_LABEL}}` label.
- Do not stop after writing local markdown drafts when a candidate passes the creation rules.
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
- If a candidate needs more research before it is actionable, skip it, record the reason, and continue to the next candidate or replacement search.

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

## Replacement Searches
- <search path> — <outcome>

## Commands Run
- `gh issue list ...`
- `gh issue create --repo {{TARGET_REPOSITORY}} --label {{ISSUE_LABEL}} ...`
```

If no issues were created, `Created: 0` is valid. Explain why.

## Completion

After writing `{{CREATED_ISSUES_FILE}}`, run:

```bash
playspec complete
```
