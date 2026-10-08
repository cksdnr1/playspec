# Phase {{PHASE_NUMBER}} — {{TASK_TITLE}}

**Task:** {{TASK_ID}}
**Feature:** {{FEATURE_SLUG}}
**Workflow:** {{WORKFLOW_TYPE}}
**Phase spec:** `{{PHASE_SPEC_FILE}}`
**Phase handoff:** `{{PHASE_HANDOFF_FILE}}`

## Current role

Verify the bug fix and its relevant regression paths.

## Required work and output

Run relevant checks and record evidence and unresolved failures in the handoff. Do not modify product code or the evaluated spec during verification. Failed required checks block completion.

{{include:rules/evaluation.md}}

Completion: this legacy phase is ungated. Complete only when its work and evidence are ready; report unresolved blockers without advancing. Do not invent a score threshold or completion result.

{{include:rules/global_rules.md}}
