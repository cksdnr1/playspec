# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Validate whether the implementation phase plan is correct, scoped, code-anchored, non-overengineered, and safe to execute.

This is a phase plan validation step.
The plan must be specific enough to route into implementation without forcing the code agent to make unresolved architecture, storage, API, mutation, ownership, lifecycle, reset/clear, or testing decisions during coding.

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
- `{{PLAN_FILE}}`
- `{{SPEC_FILE}}`
- Current repository code.

Scope rules:
- Validate the plan against actual code and the approved spec.
- Check whether each phase is implementation-ready or at least safely convertible into one mono-spec implementation task.
- Check whether any phase mixes architecture decision-making with implementation work.
- Check whether the plan is over-engineered, underspecified, or missing active-path wiring.
- Check dependencies, sequencing, reset/clear behavior, user-visible outcomes, state propagation, artifact paths, command/API contracts, and tests.
- Check that structured-artifact literals used by the plan match the approved spec and authoritative artifacts: enum/status/classification/schema/field names, value mappings, generated catalog fields, fingerprint/hash inputs, baseline anchors, and artifact paths.
- Check that no phase relies on future work unless it declares that dependency explicitly.
- Do not treat method, helper, interface, callback, command option, or data-structure existence as end-to-end implementation.
- Judge planned behavior from active entry point -> validation -> state/data update -> persistence -> propagation/callback/event -> reset/clear -> user-visible behavior -> tests.
- Explicitly identify old paths, bypass paths, partial migrations, hidden coupling, ownership/lifetime problems, callback propagation gaps, and reset/clear asymmetry.
- Flag direct file mutation, broad workspace-relative writes, missing allow-lists, missing backups, missing reports, or missing approval gates as blockers when they affect safety.
- If the plan says "decide during implementation", "for example", "optional", "TBD", or leaves storage/API/mutation boundaries open, classify it as at least Medium, and Blocker if it affects correctness, persistence, safety, or user-visible behavior.
- Missing tests for changed persistence, mutation, routing, archive, MCP, migration, prompt-rendering, workflow, or lifecycle behavior are at least Medium risk.
- Structured-artifact vocabulary/schema/catalog/hash mismatches are at least Medium risk. They are Blockers when they would make implementation choose a contract, storage/API shape, migration behavior, or safety boundary during coding.
- Do not implement code, edit files, create child tasks, or silently patch the plan unless the workflow explicitly allows editing this step.

Severity rules:
- Blocker: unresolved architecture, ownership, lifecycle, persistence, migration, fallback, correctness, state propagation, API contract, mutation safety, reset/clear, or user-visible behavior risk that prevents safe implementation.
- Medium: important ambiguity or missing detail that can be patched narrowly before coding, but does not invalidate the main direction.
- Low: wording, documentation, minor test, or clarity issue that does not block safe implementation.
- Implementation gap: behavior is not implemented yet, but the plan gives clear entry points, contracts, persistence, reset/clear behavior, tests, and boundaries.
- Future work is acceptable only when the current phase does not depend on it.

Scoring guidance:
- 95-100: implementation-ready; no blockers; phases are scoped, code-anchored, and require no architecture decisions during coding.
- 90-94: mostly ready, but still needs small plan patches before approval.
- 80-89: useful plan, but not implementation-ready; unresolved medium/high risks remain.
- 70-79: major gaps in ownership, state propagation, test strategy, or safety boundaries.
- <70: not safe to execute from this plan.

Output requirements:
- Produce markdown validation/risk output with `Score: X/100`.
- List blockers, medium risks, low risks, implementation gaps, and recommended minimal patches to the plan.
- Separately list unresolved blockers after considering valid proposed fixes.
- Include a risk ledger for:
  - oversized phases
  - undersized phases
  - missing entry points
  - unclear state propagation
  - unclear reset/clear behavior
  - missing tests
  - filename/artifact incompatibility
  - mutation safety
  - MCP/CLI drift
  - future-phase leakage
- State the exact result to pass to completion:
  - Use `playspec complete --result approved` only when the readiness score is `>= 95/100` and no blockers remain.
  - Use `playspec complete --result needs_revision` when the readiness score is below `95/100` or unresolved blockers remain.

Output markdown exactly:

0. Readiness score
- Score: X/100
- Why:

1. Final verdict
- Verdict:
- Blockers:
- Medium risks:
- Low risks:
- Implementation gaps:
- Unresolved blockers after proposed fixes:
- One-line conclusion:

2. Boundary and scope review
- Goal:
- In/out of scope:
- Phase size:
- Mono-spec readiness:
- Dependencies/deferred:
- Boundary drift:
- Future-phase leakage:

3. Code anchoring review
- Active entry points:
- Existing files/modules touched:
- Old paths:
- Bypass paths:
- Partial migrations:
- Missing code anchors:
- Repository assumptions that need verification:

4. E2E execution review
- Entry point clarity:
- Validation path:
- State/data update:
- Persistence/artifact path:
- Propagation/callback/event:
- Reset/clear behavior:
- User-visible outcome:
- Test coverage:

5. Architecture and safety review
- Layer/dependency legality:
- Interface vs concrete boundary:
- Ownership/lifetime clarity:
- Mutation boundary:
- Backup/report/approval gates:
- MCP/CLI context behavior:
- Build/include workaround risk:

6. Risks and questions
For each:
- Item:
- Classification:
- Why:
- Smallest safe fix/action:

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
- Minimum remaining plan work:
- Must not carry unresolved:
- Completion command:

9. PlaySpec feedback signal
Include this machine-readable block exactly once after the readiness sections. Keep approval threshold and feedback threshold separate: approval remains 95, feedback signal threshold is 90.

Default target rule:
- For `artifact_quality_issue`, `authoring_prompt_gap`, or `workflow_policy_gap`, target the authoring prompt by using `evolutionTargetPhaseId: implementation_plan_create` and `target.path: implementation_plan_create.md`.
- For a validator prompt gap, use `cause.category: validation_prompt_gap`, `evolutionTargetPhaseId: implementation_plan_validate`, and `target.path: implementation_plan_validate.md`.

```playspecFeedback
sourcePhaseId: implementation_plan_validate
evaluatedArtifactPhaseId: implementation_plan_create
evolutionTargetPhaseId: implementation_plan_create
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
  path: implementation_plan_create.md
  pathKind: workflow_relative
  writable: false
targetWritable: false
targetPath: src/preset/assets/workflows/mono-spec/templates/implementation_plan_create.md
summary: One concise feedback summary.
dedupeFieldValues:
  targetType: workflow_prompt_template
  targetGuidanceSection: section-name
  causeCategory: selected-cause-category
  suspectedCause: concise-cause-key
  suggestedChangeFingerprint: concise-change-key
```

Approval/gate handling:
- This implementation phase plan validation step has an approval gate.
- If the implementation plan readiness score is `>= 95/100`, no blockers remain, and the plan is implementation-ready without requiring the code agent to make architecture, storage, API, mutation-boundary, reset/clear, ownership, lifecycle, or test-strategy decisions:
  - run `playspec complete --result approved`
  - routes to Step 7. 기술 구현
- If the implementation plan readiness score is below `95/100`, any blocker remains, or implementation would require deciding storage model, API contract, mutation boundary, reset/clear behavior, ownership, lifecycle, or test strategy during coding:
  - run `playspec complete --result needs_revision`
  - routes to Step 6. 구현 계획서 업데이트
- Plain `playspec complete` must not silently choose a route for this gated step.

{{include:rules/global_rules.md}}
