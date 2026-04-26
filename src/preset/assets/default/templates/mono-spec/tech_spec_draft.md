# 1. 기술 명세서 업데이트 — {{TASK_TITLE}}

Task:
Review the relevant files for the feature and create an initial code-level technical spec.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- SOURCE_PROBLEM_FILE=`{{SOURCE_PROBLEM_FILE}}`
- MASTER_SPEC_FILE=`{{MASTER_SPEC_FILE}}`
- MASTER_PHASE_FILE=`{{MASTER_PHASE_FILE}}`
- PHASE_SPEC_FILE=`{{PHASE_SPEC_FILE}}`
- PHASE_HANDOFF_FILE=`{{PHASE_HANDOFF_FILE}}`

Source of truth:
- Start from the task title, linked source problem file when present, and current repository code.
- Treat existing docs as context, not proof of implemented behavior.

Scope rules:
- First align on the intended user-facing use case.
- Summarize the current implementation at a high level before deep code reading.
- Use the file-scanner subagent to find only the minimal directly relevant files.
- Read all must-read files first; read maybe-read files only when needed.
- Do not broaden into unrelated future phases.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Verify active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior.
- Explicitly identify old paths, bypass paths, alternate active paths, and partial migrations.

Output requirements:
- Update `{{PHASE_SPEC_FILE}}` with the initial technical spec.
- Update `{{PHASE_HANDOFF_FILE}}` with feature summary, locked file set, verified facts, control flow, constraints, active entry points, bypasses, open questions, and next phase goal.
- Include sections for Scope, Use Case alignment, high-level current implementation summary, relevant files reviewed, active entry points and bypasses, current architecture, verified behavior, problems, proposed direction, file-by-file plan, risks/open questions, and reader aids.
- Clearly separate verified code behavior, inferred behavior, and open questions.
- Include Mermaid diagrams only when they improve understanding and label proposed flow separately from verified flow.

Approval/gate handling:
- No approval result is required for this step. Complete normally when the draft and handoff are updated.

{{include:rules/global_rules.md}}
