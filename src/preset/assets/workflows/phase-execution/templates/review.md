# Phase {{PHASE_NUMBER}} — {{TASK_TITLE}}

**Task:** {{TASK_ID}}
**Feature:** {{FEATURE_SLUG}}
**Workflow:** {{WORKFLOW_TYPE}}
**Phase spec:** `{{PHASE_SPEC_FILE}}`
**Phase handoff:** `{{PHASE_HANDOFF_FILE}}`

## Current role

Review the selected phase diff and verification evidence.

## Required work and output

Write findings and readiness to the handoff. Keep product code and evaluated spec read-only. Do not mark unresolved correctness/safety blockers ready.

{{include:rules/evaluation.md}}

Completion: this legacy phase is ungated. Complete only when its work and evidence are ready; report unresolved blockers without advancing. Do not invent a score threshold or completion result.

{{include:rules/global_rules.md}}
