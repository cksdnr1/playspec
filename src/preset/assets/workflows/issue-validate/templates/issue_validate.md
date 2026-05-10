# Issue Validation — {{TASK_TITLE}}

**Task:** `{{TASK_ID}}`
**Issue:** #{{ISSUE_NUMBER}} — {{ISSUE_URL}}
**Source:** `{{SOURCE_PROBLEM_FILE}}`

## Goal

Validate whether this issue should move forward before anyone implements it. This workflow is for humans or agents, so judge the issue itself, not who requested it.

Do not implement the issue in this phase. Inspect the repository, relevant docs, code paths, existing tests, and any linked context needed to decide whether the issue is necessary, clear, safe, and worth doing now.

## Approval Rule

Use a 100 point score. Approve only when the final score is **90 or higher** and there are no blocking safety, security, tenant-isolation, data-loss, or architectural concerns.

- Score `90-100`: complete this phase with `playspec complete --result approved`.
- Score `0-89`: complete this phase with `playspec complete --result rejected`.

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

## Decision
- Status: APPROVED | REJECTED
- Score: <0-100>
- Threshold: 90
- Issue: #{{ISSUE_NUMBER}}

## Summary
- One sentence stating whether this issue should proceed and why.

## Evidence Checked
- Files, commands, database/query outputs, linked issues, or docs inspected.

## Score Breakdown
- Problem and value evidence: <score>/25
- Correctness/security/business impact: <score>/20
- Scope clarity and implementability: <score>/20
- Architecture/product fit: <score>/15
- Testability and acceptance criteria: <score>/10
- Urgency/dependencies/sequencing: <score>/10

## Blocking Problems
- List concrete blockers, or `None`.

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

- Run `playspec complete --result approved` if the score is 90 or higher.
- Run `playspec complete --result rejected` if the score is lower than 90.
