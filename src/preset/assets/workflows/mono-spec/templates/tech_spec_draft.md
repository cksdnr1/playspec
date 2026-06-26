# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Review the relevant files for the feature and create an initial code-level technical spec.

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
- SPEC_FILE=`{{SPEC_FILE}}`
- PLAN_FILE=`{{PLAN_FILE}}`
- RESULT_FILE=`{{RESULT_FILE}}`
- PR_FILE=`{{PR_FILE}}`

Source of truth:
- Start from the task title, linked source problem file when present, and current repository code.
- Treat existing docs as context, not proof of implemented behavior.

Evidence-first structured facts:
- Before proposing types, schemas, descriptors, catalog rows, fingerprints, migrations, CLI/API contracts, or acceptance criteria, extract the exact facts from directly relevant structured artifacts when they exist. Structured artifacts include JSON, YAML, OpenAPI, Prisma/schema files, SQL/migration files, package manifests, generated catalogs, baselines, fixtures, and machine-readable reports.
- Record a compact evidence table when structured artifacts influence the spec. Include artifact path, field/key path, target subset or filter, literal values or value distribution/counts, and whether each value is reused, mapped, deferred, or rejected.
- When a structured artifact contains literal enum, vocabulary, status, classification, or field names, reuse those literals verbatim unless the spec defines an explicit migration or compatibility mapping. Do not invent, rename, merge, or normalize enum names because they sound cleaner or more canonical.
- If multiple sources disagree, do not choose silently. State the authoritative source, the conflict, the risk, and the test or follow-up needed to resolve it.

Scope rules:
- First align on the intended user-facing use case.
- Summarize the current implementation at a high level before deep code reading.
- Use the available file-discovery workflow for the environment to find only the minimal directly relevant files. If a file-scanner subagent exists, use it; otherwise use targeted repository search such as `rg`, `rg --files`, or equivalent tooling.
- Read all must-read files first; read maybe-read files only when needed.
- Do not broaden into unrelated future phases.
- Do not treat method, helper, interface, callback, or data-structure existence as end-to-end implementation.
- Verify active entry point -> state/data update -> propagation/callback/event -> reset/clear -> user-visible behavior.
- Explicitly identify old paths, bypass paths, alternate active paths, and partial migrations.
- Before completing, run an internal consistency pass across proposed type names, required fields, fingerprint/hash inputs, generated artifacts, acceptance criteria, rollback/flag posture, and tests. Remove parallel vocabularies unless an explicit compatibility mapping is part of the spec.
- Keep deterministic contract/hash/catalog inputs separate from implementation provenance, runtime observations, timestamps, environment-specific values, and other volatile data.

Output requirements:
- Update `{{SPEC_FILE}}` with the initial technical spec.
- Include sections for Scope, Use Case alignment, high-level current implementation summary, relevant files reviewed, active entry points and bypasses, current architecture, verified behavior, problems, proposed direction, file-by-file plan, risks/open questions, and reader aids.
- Clearly separate verified code behavior, inferred behavior, and open questions.
- Include the structured evidence table when structured artifacts drive proposed contracts, schema choices, descriptor metadata, catalog/fingerprint fields, or acceptance tests.
- Include Mermaid diagrams only when they improve understanding and label proposed flow separately from verified flow.

Approval/gate handling:
- No approval result is required for this step.
- Complete normally when `SPEC_FILE` is updated.

{{include:rules/global_rules.md}}
