# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Validate the current implementation technical spec and produce a markdown validation/risk ledger.

This step does not edit files directly.
This step is for Codex/the code agent to review the current technical spec against the repository and decide the gated result.

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
- `{{SPEC_FILE}}`
- Linked source problem and context files when present.
- Current repository code.

Validation instructions:
Review the technical spec and produce a compact markdown validation plus patch-ready risk ledger.

This is review only.
Do not implement, rewrite the spec, or write code.

Start with a readiness score X/100 and a one-line reason.
The score means implementation confidence based on whether this spec is safe for a code agent to implement against the current repository without making unresolved architecture, ownership, lifecycle, state, mutation, or testing decisions during coding.

Validate:
- phase/workflow boundary
- implementation scope and mono-spec size
- architecture legality
- hidden risks
- ownership/lifecycle/migration/fallback ambiguity
- old paths and bypass paths
- persistence/state propagation
- reset/clear behavior
- mutation boundaries and allow-lists
- CLI/MCP/API entry point contracts
- contradictions
- structured-artifact vocabulary/schema mismatches
- over-engineering
- premature readiness claims
- acceptance criteria quality
- test coverage quality
- interface vs concrete boundary safety
- build/include workaround risk
- diagram truthfulness
- end-to-end user-visible behavior chain

Rules:
- This is an implementation technical spec validation, not a high-level planning review.
- The spec must be specific enough for a code agent to implement without making architecture decisions during coding.
- "Not implemented" alone is not a blocker.
- However, missing implementation path, missing API contract, missing persistence model, missing state propagation, missing reset/clear behavior, missing mutation boundary, missing ownership, or missing tests is a blocker when it affects correctness, safety, or user-visible behaviour.
- Blocker = unresolved architecture, ownership, lifecycle, migration, fallback, correctness, state propagation, API contract, persistence, reset/clear, mutation safety, or user-visible behavior risk.
- Medium = important implementation ambiguity that can be patched narrowly before coding, but does not invalidate the main architecture.
- Low = wording, documentation, minor test, or clarity issue that does not block safe implementation.
- "Answered but not implemented" = implementation gap only if the spec gives a clear path, contract, tests, and boundaries.
- If the spec says "decide during implementation", "for example", "optional", "TBD", or leaves storage/API/mutation boundaries open, classify it as at least Medium, and Blocker if it affects correctness or safety.
- The workflow/spec boundary is the source of truth, but proof wording is not proof of correctness.
- Do not treat helper, interface, callback, command option, function, or data-structure existence as end-to-end implementation.
- Judge end-to-end from active entry point -> validation -> state/data update -> persistence -> propagation/callback/event -> reset/clear -> final user-visible behavior -> tests.
- Missing tests for changed persistence, mutation, routing, archive, MCP, migration, prompt-rendering, workflow, or lifecycle behavior are at least Medium risk.
- Hidden write paths, direct file mutation, broad workspace-relative writes, or unclear allow-lists are Blockers unless explicitly gated by schema validation, backup, report, and approval.
- Future work may be deferred only if the current phase does not depend on it.
- If unclear, mark it as risk; do not assume implementation will solve it safely.
- Prefer patch-ready fixes, but do not lower severity just because the fix is small.
- Avoid redesign unless the current spec cannot be safely patched.
- If a spec proposes enum, vocabulary, status, classification, schema, or field names that conflict with literal values in an authoritative structured artifact, classify it as at least Medium. Classify it as Blocker when the mismatch would affect storage, API/runtime behavior, security, policy, migration correctness, user-visible behavior, or force implementation-time architecture decisions.
- If a structured artifact is material to the spec but the spec omits the artifact path, field/key path, target subset/filter, or value distribution/counts needed to reproduce the claim, classify it as at least Medium when the omission could lead to invented metadata or ambiguous implementation.
- If deterministic hashes, fingerprints, committed catalogs, or baseline comparisons include volatile runtime observations, timestamps, environment-specific values, or implementation provenance without an explicit stable mapping, classify it as at least Medium.
- If the spec defines parallel vocabularies for the same concept without a clear canonical field and compatibility mapping, classify it as at least Medium.
- If contract versioning rules conflict with the fingerprint/hash input set, classify it as at least Medium, and Blocker when it would make compatibility or migration behavior unsafe.

Scoring guidance:
- 95-100: implementation-ready; no blockers; only minor wording or small test additions.
- 90-94: mostly ready, but still needs small spec patches before approval.
- 80-89: useful draft, but not implementation-ready; unresolved medium/high risks remain.
- 70-79: major gaps in ownership, state propagation, tests, safety boundaries, or user-visible behaviour.
- <70: not safe to implement from this spec.

Output markdown exactly:

0. Readiness score
- Score: X/100
- Why:

1. Final verdict
- Verdict:
- Blockers:
- Medium/low risks:
- Implementation gaps:
- Open questions:
- Architecture/diagram concerns:
- One-line conclusion:

2. Boundary summary
- Goal:
- In/out of scope:
- Dependencies/deferred:
- Boundary drift:
- Layers/dependency direction:
- Cross-boundary interfaces:
- Layer-local concrete classes:
- Architecture migration/build-boundary dependency: yes/no/unclear

3. Solid parts
- Already coherent and safe:

4. Risks and questions
For each:
- Item:
- Classification:
- Why:
- Smallest safe fix/action:

5. Architecture and E2E review
- Layer legality:
- Interface/concrete clarity:
- State/persistence clarity:
- Reset/clear clarity:
- Mutation boundary clarity:
- Build workaround risk:
- Diagram result:
- Missing verification chains:
- Required spec statements:

6. Test and acceptance review
- Existing tests relevant to this spec:
- Missing required tests:
- Acceptance criteria quality:
- User-visible verification:
- Regression coverage needed:

7. Patch-ready ledger
For each:
- Risk ID:
- Classification:
- Target section:
- Problem:
- Patch action:
- Patch intent:
- Keep active?: yes/no

8. Final readiness
- Safe to implement now:
- Minimum remaining spec work:
- Must not carry unresolved:

9. PlaySpec feedback signal
Include this machine-readable block exactly once after the readiness sections. Keep approval threshold and feedback threshold separate: approval remains 95, feedback signal threshold is 90.

Default target rule:
- For `artifact_quality_issue`, `authoring_prompt_gap`, or `workflow_policy_gap`, target the authoring prompt by using `evolutionTargetPhaseId: tech_spec_draft` and `target.path: tech_spec_draft.md`.
- For a validator prompt gap, use `cause.category: validation_prompt_gap`, `evolutionTargetPhaseId: tech_spec_validate`, and `target.path: tech_spec_validate.md`.

```playspecFeedback
sourcePhaseId: tech_spec_validate
evaluatedArtifactPhaseId: tech_spec_draft
evolutionTargetPhaseId: tech_spec_draft
score: X
approval:
  threshold: 95
  result: approved | needs_revision
feedback:
  threshold: 90
  result: positive | negative
cause:
  category: artifact_quality_issue | authoring_prompt_gap | validation_prompt_gap | workflow_policy_gap | extractor_or_parser_error
  confidence: low | medium | high
  summary: One concise sentence naming the cause.
promptEvolution:
  targetType: workflow_prompt_template
  guidance: One concise prompt improvement recommendation.
workflowSource:
  kind: bundled_preset
  root: src/preset/assets/workflows/mono-spec
  rootPathKind: package_relative
  packageName: playspec
  presetId: default
  version: 1
target:
  path: tech_spec_draft.md
  pathKind: workflow_relative
  writable: false
targetWritable: false
targetPath: src/preset/assets/workflows/mono-spec/templates/tech_spec_draft.md
summary: One concise feedback summary.
dedupeFieldValues:
  targetType: workflow_prompt_template
  targetGuidanceSection: section-name
  causeCategory: selected-cause-category
  suspectedCause: concise-cause-key
  suggestedChangeFingerprint: concise-change-key
```

Approval/gate handling:
- This validation step has an approval gate.
- If the technical spec readiness score is `>= 95/100`, no blockers remain, and the spec is implementation-ready without requiring the code agent to make architecture, storage, API, mutation-boundary, reset/clear, or test-strategy decisions:
  - run `playspec complete --result approved`
  - routes to Step 4. 구현 계획서 생성
- If the technical spec readiness score is below `95/100`, any blocker remains, or implementation would require deciding storage model, API contract, mutation boundary, reset/clear behavior, ownership, lifecycle, or test strategy during coding:
  - run `playspec complete --result needs_revision`
  - routes to Step 3. 기술 명세서 업데이트
- Plain `playspec complete` must not silently choose a route for this gated step.
