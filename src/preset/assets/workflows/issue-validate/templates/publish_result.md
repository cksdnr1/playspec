# Publish Issue Validation — {{TASK_TITLE}}

**Task:** `{{TASK_ID}}`
**Issue:** #{{ISSUE_NUMBER}} — {{ISSUE_URL}}

## Inputs

- Validation report: `{{VALIDATION_FILE}}`
- Issue comment body: `{{ISSUE_COMMENT_FILE}}`
- Issue body update: `{{ISSUE_BODY_UPDATE_FILE}}`

## Instructions

Publish the validation result back to the GitHub issue when GitHub CLI or API access is available. This phase may only comment on the issue, update the issue body, and adjust validation labels. Do not implement the issue and do not modify product code.

1. Read `{{VALIDATION_FILE}}` and confirm it contains a final `APPROVED` or `REJECTED` decision and a numeric score.
2. Read `{{ISSUE_COMMENT_FILE}}` and post it to issue #{{ISSUE_NUMBER}}.
3. If `{{ISSUE_BODY_UPDATE_FILE}}` is not exactly `NO_BODY_UPDATE`, update the issue body with that file after confirming it preserves useful original context.
4. If labels are available, apply one clear validation label:
   - Approved: `issue-validated`
   - Rejected: `issue-needs-rewrite`
5. If GitHub access is unavailable, leave the files ready to post and include the exact commands that should be run.

Preferred commands:

```bash
gh issue comment {{ISSUE_NUMBER}} --body-file "{{ISSUE_COMMENT_FILE}}"
gh issue edit {{ISSUE_NUMBER}} --body-file "{{ISSUE_BODY_UPDATE_FILE}}"
gh issue edit {{ISSUE_NUMBER}} --add-label issue-validated
gh issue edit {{ISSUE_NUMBER}} --add-label issue-needs-rewrite
```

Only run the body update command when `{{ISSUE_BODY_UPDATE_FILE}}` contains a real replacement body.

## Completion

After publishing or preparing the publish commands, run:

```bash
playspec complete
```
