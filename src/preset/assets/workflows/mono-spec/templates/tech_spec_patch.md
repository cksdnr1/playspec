# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Review only the minimal directly related files needed to verify already-identified risks, then strengthen the existing spec and handoff for `{{FEATURE_SLUG}}` with a finalized risk ledger as a minimal in-place patch set.

Variables:
- FEATURE_SLUG=`{{FEATURE_SLUG}}`
- TASK_TITLE=`{{TASK_TITLE}}`
- STEP_NUMBER=`{{STEP_NUMBER}}`
- STEP_ID=`{{STEP_ID}}`
- STEP_TITLE=`{{STEP_TITLE}}`
- SPEC_FILE=`{{SPEC_FILE}}`
- PLAN_FILE=`{{PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`
- PR_FILE=`{{PR_FILE}}`

Source of truth:
- `{{SPEC_FILE}}`
- Latest markdown technical validation/risk score output from Step 2, including `Score: X/100`.
- Current repository code for directly related verification only.

Scope rules:
- Patch existing docs in place; do not rewrite the spec from scratch.
- Keep the risk ledger minimal, code-level, and actionable.
- Do not add future phases or broad architecture.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Verify active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior before marking a path complete.
- For every risk about schemas, descriptors, catalogs, fingerprints, migrations, policy tiers, status values, or generated artifacts, re-check the exact structured artifact field paths and literal values before patching.
- After patching, perform a narrow consistency sweep for stale or parallel vocabulary names, field-name drift, fingerprint/hash input drift, deterministic catalog inputs, acceptance criteria coverage, rollback/flag posture, and test targets.
- Do not preserve old invented enum/status/classification names unless the spec explicitly defines a compatibility mapping and tests for it.
- Keep deterministic contract/hash/catalog inputs separate from runtime observations, environment-specific values, timestamps, and implementation provenance.

Output requirements:
- Update `{{SPEC_FILE}}`.
- Record which validation issues were resolved, downgraded, or remain blockers, and reference the latest Step 2 score.
- Record the structured-artifact checks used for resolved vocabulary/schema/catalog/fingerprint risks, including any grep or value-distribution check that proves old names are gone.
- Keep markdown readable for the implementation planner.

Approval/gate handling:
- No approval result is required for this patch step.
- Complete normally after updating `SPEC_FILE`.
- `playspec complete` routes back to Step 2. 기술 교차 검증.

{{include:rules/global_rules.md}}
