# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

{{include:rules/evaluation.md}}

Task:
Validate the total technical specification for downstream phase planning readiness.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- SOURCE_PROBLEM_FILE=`{{SOURCE_PROBLEM_FILE}}`
- CONTEXT_FILES:
{{CONTEXT_FILES}}
- CONTEXT_REFS_DETAIL:
{{CONTEXT_REFS_DETAIL}}
- TOTAL_SPEC_FILE=`{{TOTAL_SPEC_FILE}}`
- PHASE_PLAN_FILE=`{{PHASE_PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`

Source of truth:
- `{{TOTAL_SPEC_FILE}}`
- Linked source problem and context files when present.
- Current repository code.

Scope rules:
- Validate the total spec against actual code paths and user-visible behavior.
- Validate structured-artifact consistency: enum/status/classification/schema/field names, value distributions, subset filters, generated catalog fields, fingerprint/hash inputs, deterministic artifact boundaries, baseline anchors, and artifact paths must match authoritative structured artifacts or declare an explicit migration/mapping.
- Do not create or patch the phase plan in this step.
- Do not treat helper, interface, callback, method, command option, or data-structure existence as end-to-end implementation proof.
- Check active entry point -> state/data update -> propagation/callback/event -> reset/clear -> final user-visible behavior.

Write boundary:
- Keep evaluated planning artifacts and product code read-only. Write only the named validation report and review findings; do not silently patch the inputs.

Output requirements:
- Report findings first, ordered by severity.
- Include a readiness score from 0 to 100.
- Include a concise risk ledger covering missing entry points, stale assumptions, unverified behavior, structured-artifact vocabulary/schema/catalog/hash mismatches, output filename compatibility, and future-phase leakage.
- Classify structured-artifact vocabulary/schema/catalog/hash mismatches as at least Medium. Classify them as Blockers when they would force a later phase to choose a contract, storage/API shape, migration behavior, or safety boundary.
- State the exact result to pass to completion:
  - Use `playspec complete --result approved` only when the readiness score is `>= 95` and no blockers remain.
  - Use `playspec complete --result needs_revision` when the readiness score is below `95` or unresolved blockers remain.
- Do not update `{{PHASE_PLAN_FILE}}`.

Approval/gate handling:
- This is a gated phase.
- `approved` routes to phase plan creation.
- `needs_revision` routes to total spec patching.


## Required engine validation report

Write a version-1 YAML or JSON report to `{{TOTAL_SPEC_VALIDATION_FILE}}` before completing this phase. The engine rejects completion without this report, even if you pass `approved`.

Required fields:
- `version: 1`, `taskId: "{{TASK_ID}}"`, `phaseId: "total_spec_validate"`, and `result` matching the completion result.
- `score`: the numeric sum of earned rubric points; `blockers`: an array of unresolved blockers (empty only when none remain); `summary`: the evidence-based verdict.
- Required rubric names and maxima: `correctness`=30, `contracts`=25, `failure_handling`=20, `testability`=15, `scope`=10.
- `dimensions`: one entry per scoring dimension, each with `name`, numeric `earned` and `max`, nonempty `evidence` references, and `deductions` explaining lost points. Maxima must total 100 and earned points must equal score.
- `artifacts`: exactly the evaluated files listed below, each with its workspace-relative `path` and SHA-256 `sha256` of the current file bytes:
  - `{{TOTAL_SPEC_FILE}}`

For approval, score must be at least 95 and blockers must be empty. Recompute hashes and rewrite the report after any artifact changes; prior reports do not approve a changed file. Keep human-readable findings as well. Report schema and a complete example: `docs/validation-reports.md`.

{{include:rules/global_rules.md}}
