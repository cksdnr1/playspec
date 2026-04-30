# {{STEP_NUMBER}}. {{STEP_TITLE}} — {{TASK_TITLE}}

Task:
Prepare an external GPT validation prompt for the current technical spec.

This step does not edit files directly.
This step is for asking an external Web GPT to review the pasted technical spec, then the human/user reviews the GPT answer before the next patch step.

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

Operator instructions:
1. Open the current technical spec from `{{SPEC_FILE}}`.
2. Copy the full spec content.
3. Paste the external GPT prompt below into Web GPT.
4. Paste the copied spec content into the `PASTED TECHNICAL SPEC` section.
5. Review GPT's answer manually.
6. Use the reviewed answer as input for the next step: technical spec patch.

External GPT prompt to copy:

```text
Task:
Review the pasted technical spec and produce a compact validation plus patch-ready risk ledger.

Do not assume repo files, hidden docs, code, paths, or external context.
Use ONLY the pasted technical spec below.
This is review only.
Do not implement, rewrite the spec, or write code.

Start with a readiness score X/100 and a one-line reason.
The score means implementation confidence based only on the pasted spec readiness, not whether the implementation already exists.

Validate:
- phase/workflow boundary
- architecture legality
- hidden risks
- ownership/lifecycle/migration/fallback ambiguity
- old paths and bypass paths
- contradictions
- over-engineering
- premature readiness claims
- acceptance criteria quality
- interface vs concrete boundary safety
- build/include workaround risk
- diagram truthfulness
- end-to-end user-visible behavior chain

Rules:
- "Not implemented" alone is not a blocker.
- Blocker = unresolved architecture, ownership, lifecycle, migration, fallback, or correctness risk.
- "Answered but not implemented" = implementation gap.
- The workflow/spec boundary is the source of truth, but proof wording is not proof of correctness.
- Do not treat helper, interface, callback, command option, function, or data-structure existence as end-to-end implementation.
- Judge end-to-end from active entry point -> state/data update -> propagation/callback/event -> reset/clear -> final user-visible behavior.
- If unclear, say "unclear from pasted context."
- Prefer narrow clarification or small patch actions over redesign.

Output exactly:

0. Readiness score
- Score:
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
- Build workaround risk:
- Diagram result:
- Missing verification chains:
- Required spec statements:

6. Patch-ready ledger
For each:
- Risk ID:
- Classification:
- Target section:
- Problem:
- Patch action:
- Patch intent:
- Keep active?: yes/no

7. Final readiness
- Safe to implement now:
- Minimum remaining spec work:
- Must not carry unresolved:

PASTED TECHNICAL SPEC:
<<<PASTE SPEC CONTENT HERE>>>

Approval/gate handling:
- This validation step has an approval gate.
- If the technical spec is good enough to proceed:
  - run `playspec complete --result approved`
  - routes to Step 4. 구현 계획서 생성
- If the technical spec needs revision:
  - run `playspec complete --result needs_revision`
  - routes to Step 3. 기술 명세서 업데이트
- Plain `playspec complete` must not silently choose a route for this gated step.