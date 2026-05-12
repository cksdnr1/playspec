# Issue Scope Create Workflow

`issue-scope-create` is a built-in PlaySpec workflow for creating GitHub issues from a narrow repository inspection scope.

It is separate from `issue-validate`. `issue-validate` judges an existing issue; `issue-scope-create` finds concrete non-duplicate problems and creates new PlaySpec-ready issues.

## When To Use

Use this workflow when you want an agent or human to inspect a target repository and create a small number of actionable issues for a specific scope, such as:

- reorder-risk improvement
- SyncJob freshness and reliability
- workflow entry-point improvement
- inventory mapping correctness
- frontend/backend UX gap

Do not use it for implementation work, broad roadmap planning, or general repository audits.

## Variables

- `TARGET_REPOSITORY`: GitHub repository such as `owner/repo`.
- `ISSUE_SCOPE`: Narrow discovery scope.
- `FOCUS_AREA`: Specific subsystem, workflow, product area, or code path.
- `OUT_OF_SCOPE_RULES`: Boundaries that must not become issues.
- `DUPLICATE_SEARCH_QUERY`: Base GitHub issue search query.
- `MAX_ISSUES`: Maximum number of issues to create. Defaults to `3`.
- `ISSUE_LABEL`: Label applied to every created issue. Defaults to `agent-validation`.

## Run Example

```bash
playspec create "Create scoped inventory mapping issues" \
  --workflow issue-scope-create \
  --var TARGET_REPOSITORY=cksdnr1/AliveSolution \
  --var ISSUE_SCOPE="inventory mapping correctness" \
  --var FOCUS_AREA="ChannelInventory, ChannelProductMapping, ChannelVariantRef joins" \
  --var OUT_OF_SCOPE_RULES="Do not implement fixes. Do not create broad data cleanup issues. Do not touch unrelated reorder UI." \
  --var DUPLICATE_SEARCH_QUERY="inventory mapping ChannelInventory ChannelProductMapping" \
  --var MAX_ISSUES=3 \
  --var ISSUE_LABEL=agent-validation

playspec next
```

The discovery phase writes a report and candidate issue drafts. Complete it with:

```bash
playspec complete --result candidates_found
```

or:

```bash
playspec complete --result no_issues
```

When candidates exist, the creation phase re-checks duplicates and creates at most `MAX_ISSUES` GitHub issues with `gh issue create --label ISSUE_LABEL`.

## Issue Body Format

Every created issue must contain:

- Problem
- Context
- Impact
- Scope
- Out of scope
- Acceptance criteria
- Test requirements
- Risk notes
- Recommended workflow

## Validation Examples

Accepted narrow candidate:

- Scope: `inventory mapping correctness`
- Finding: `ChannelInventory` lookup joins by product name while canonical mapping exists by `ChannelProductMapping`.
- Evidence: specific service file, failing test, or query output.
- Result: create one issue with a testable acceptance criterion for the lookup path.

Rejected broad candidate:

- Scope: `inventory mapping correctness`
- Finding: "Improve all inventory logic."
- Reason: too broad, no single code path, no concrete acceptance criteria.

Rejected duplicate candidate:

- Scope: `SyncJob freshness and reliability`
- Finding: sync job orphan recovery missing alert.
- Duplicate search finds an existing open issue covering orphan recovery alerting.
- Result: no new issue; record duplicate in the discovery report.
