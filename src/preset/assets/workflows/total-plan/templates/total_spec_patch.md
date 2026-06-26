# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Patch the total technical specification using the latest validation findings.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- TOTAL_SPEC_FILE=`{{TOTAL_SPEC_FILE}}`
- PHASE_PLAN_FILE=`{{PHASE_PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`

Source of truth:
- `{{TOTAL_SPEC_FILE}}`
- The most recent total spec validation findings.
- Current repository code for any disputed behavior.

Scope rules:
- Patch `{{TOTAL_SPEC_FILE}}` in place.
- Keep changes focused on validation findings and verified code reality.
- Preserve reader-friendly structure and do not rewrite stable sections unnecessarily.
- Do not create `{{PHASE_PLAN_FILE}}` yet.
- Do not implement code or future phases.
- For every risk about schemas, descriptors, catalogs, fingerprints, migrations, policy tiers, status values, generated artifacts, or phase boundaries, re-check the exact structured artifact field paths and literal values before patching.
- After patching, perform a narrow consistency sweep for stale or parallel vocabulary names, field-name drift, fingerprint/hash input drift, deterministic catalog inputs, acceptance criteria coverage, rollback/flag posture, and downstream test gates.
- Do not preserve old invented enum/status/classification names unless the total spec explicitly defines a compatibility mapping and tests for it.
- Keep deterministic contract/hash/catalog inputs separate from runtime observations, environment-specific values, timestamps, and implementation provenance.

Output requirements:
- Update `{{TOTAL_SPEC_FILE}}`.
- Make the smallest documentation change that resolves the validation findings.
- Keep verified, inferred, and open-question statements clearly separated.

Approval/gate handling:
- No approval result is required for this step.
- Complete normally after patching; the workflow returns to total spec validation.

{{include:rules/global_rules.md}}
