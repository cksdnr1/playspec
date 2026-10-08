# Issue Validation — {{TASK_TITLE}}

{{include:rules/evaluation.md}}

**Task:** `{{TASK_ID}}`
**Issue:** #{{ISSUE_NUMBER}} — {{ISSUE_URL}}
**Source:** `{{SOURCE_PROBLEM_FILE}}`

## Goal

Validate whether this issue should move forward before anyone implements it. This workflow is for humans or agents, so judge the issue itself, not who requested it.

Do not implement the issue in this phase. Inspect the repository, relevant docs, code paths, existing tests, and any linked context needed to decide whether the issue is necessary, clear, safe, and worth doing now.

## Approval Rule

Use a 100 point score. Approve only when the final score is **90 or higher** and there are no blocking safety, security, tenant-isolation, data-loss, or architectural concerns.

- Score `90-100` with no unresolved blockers: complete this phase with `playspec complete --result approved`.
- Score `0-89` or any unresolved blocker: complete this phase with `playspec complete --result rejected`.

If the issue is directionally valuable but ambiguous, over-broad, missing evidence, or has a better implementation direction, reject it and write a replacement issue body in `{{ISSUE_BODY_UPDATE_FILE}}`.

## Scoring Rubric

- Problem and value evidence: 25 points
- Correctness, security, data, or business impact: 20 points
- Scope clarity and implementability: 20 points
- Fit with existing architecture and product direction: 15 points
- Testability and acceptance criteria: 10 points
- Urgency, dependencies, and sequencing: 10 points

Apply deductions for duplicate issues, missing reproduction steps, unclear affected users, speculative work, mixed unrelated goals, missing data needed for validation, or requests that would bypass established pipeline boundaries.

## Required Checks

1. Confirm the issue describes a real problem or decision, not only a vague desired change.
2. Check whether the issue is already solved, duplicated, obsolete, or contradicted by current code.
3. Identify the exact product, data, security, or developer workflow risk.
4. Trace likely entry points in the codebase and verify the issue matches how the system actually works.
5. Decide whether the acceptance criteria are concrete enough to test.
6. Decide whether the issue should be split before implementation.
7. For any issue involving tenant, account, permissions, data deletion, synchronization, mapping, or workflow automation, explicitly call out isolation and rollback risk.

## Write Artifacts

Write `{{VALIDATION_FILE}}` with this structure:

```markdown
# Issue Validation

## Evidence Checked
- Files, commands, database/query outputs, linked issues, or docs inspected.

## Findings and Blocking Problems
- List grounded findings and unresolved blockers, or `None`; cite checked evidence.

## Score Breakdown
- Problem and value evidence: <score>/25
- Correctness/security/business impact: <score>/20
- Scope clarity and implementability: <score>/20
- Architecture/product fit: <score>/15
- Testability and acceptance criteria: <score>/10
- Urgency/dependencies/sequencing: <score>/10

## Decision
- Status: APPROVED | REJECTED
- Score: <0-100>
- Threshold: 90
- Issue: #{{ISSUE_NUMBER}}
- Approve only at/above threshold with no unresolved blockers.

## Summary
- One sentence stating whether this issue should proceed and why, based on the findings and calculated score.

## Better Direction
- If rejected but valuable, describe the better issue direction.
- If approved, write `No rewrite needed`.

## Acceptance Criteria
- The minimum testable criteria this issue must satisfy.

## Implementation Boundaries
- What implementation should not touch.

## Comment To Post
- The exact GitHub issue comment summary.
```

Write `{{ISSUE_COMMENT_FILE}}` as a concise GitHub issue comment:

- Start with `Issue validation: APPROVED` or `Issue validation: REJECTED`.
- Include the score and the main reason.
- If rejected, list what must change before implementation.
- If approved, list the implementation boundaries and required tests.

Write `{{ISSUE_BODY_UPDATE_FILE}}` only when the issue should be rewritten. The file must be a full replacement body, not notes. If no rewrite is needed, write:

```markdown
NO_BODY_UPDATE
```

## Completion

After writing the artifacts:

- Run `playspec complete --result approved` only if the score is 90 or higher and no unresolved blockers remain.
- Run `playspec complete --result rejected` if the score is lower than 90 or any unresolved blocker remains.

## Required engine validation report

Write a version-1 YAML or JSON report to `{{VALIDATION_REPORT_FILE}}` before completing this phase. The engine rejects completion without this report, even if you pass `approved`.

Required fields:
- `version: 1`, `taskId: "{{TASK_ID}}"`, `phaseId: "issue_validate"`, and `result` matching the completion result.
- `score`: the numeric sum of earned rubric points; `blockers`: an array of unresolved blockers (empty only when none remain); `summary`: the evidence-based verdict.
- Required rubric names and maxima: `problem_value`=25, `impact`=20, `scope`=20, `architecture`=15, `testability`=10, `sequencing`=10.
- `dimensions`: one entry per scoring dimension, each with `name`, numeric `earned` and `max`, nonempty `evidence` references, and `deductions` explaining lost points. Maxima must total 100 and earned points must equal score.
- `artifacts`: exactly the evaluated files listed below, each with its workspace-relative `path` and SHA-256 `sha256` of the current file bytes:
  - `{{SOURCE_PROBLEM_FILE}}`

For approval, score must be at least 90 and blockers must be empty. Recompute hashes and rewrite the report after any artifact changes; prior reports do not approve a changed file. Keep human-readable findings as well. Report schema and a complete example: `docs/validation-reports.md`.

{{include:rules/global_rules.md}}
