# Multi Mono-Spec Workflow / Template Integration Tech Spec

> Status: draft technical spec
> Target project: PlaySpec
> Proposed capability: first-class workflow and template support for running several mono-spec executions as one audited multi-phase delivery
> Source use case: issue #305 style five-pass execution, where a total spec and phase plan are implemented through exactly one mono-spec pass per phase

## 1. Problem

PlaySpec already supports `mono-spec` and planning workflows, but a large implementation often needs a total plan split into multiple mono-spec-sized phases.

Today the process depends too much on operator discipline. A runner can accidentally or intentionally:

- implement the whole feature in one broad pass;
- create several phase folders afterward;
- create several task ids without completing real phase workflows;
- generate retrospective evidence after implementation;
- claim "N mono-spec executions completed" without a phase-by-phase execution trail.

That is not enough for strict review. For a multi-phase total plan, the reviewer needs proof that each phase was separately specified, planned, implemented, validated, and closed before the next phase advanced.

## 2. Goal

Add a reusable PlaySpec workflow/template pattern for **multi mono-spec execution**:

- one parent orchestration task owns the total spec and phase plan;
- each child phase is a real mono-spec execution;
- the parent can only be considered complete when all child phases have approval-safe evidence;
- retrospective artifacts are allowed only as audit notes and never count as original execution proof;
- the final PR can show an auditable phase table with task id, evidence path, score, active-path proof, and approval-safe status.

## 3. Non-Goals

- Do not require one coding-agent/chat session per phase. The invariant is one real PlaySpec mono-spec execution per phase, not one external session.
- Do not build a full DAG scheduler in the first iteration.
- Do not automatically merge or push user code.
- Do not accept document-only validation when the phase changes active product behavior.
- Do not let retrospective artifact creation satisfy execution gates.

## 4. Proposed User-Facing Model

### Workflow ids

Introduce one or both names below. Recommendation: ship `multi-mono-spec` first and keep aliases later if needed.

- `multi-mono-spec`: parent workflow for orchestrating N child mono-spec phases.
- `phase-mono-spec`: optional child workflow alias, equivalent to `mono-spec` but with required parent/phase metadata.

### Common command shape

The exact CLI can be refined, but the user-facing flow should support this shape:

```bash
playspec create multi-mono-spec "Issue 305 reorder-risk metric cards" --from-total-plan docs/features/.../total_spec.md --from-phase-plan docs/features/.../phase_plan.md
playspec multi-mono-spec prepare --task issue_305_reorder_risk_metric_cards --phases 5
playspec multi-mono-spec start-phase --task issue_305_reorder_risk_metric_cards --phase 1
playspec prompt
playspec complete --result approved
# repeat the mono-spec phases and validation gates
playspec multi-mono-spec status --task issue_305_reorder_risk_metric_cards
playspec multi-mono-spec final-report --task issue_305_reorder_risk_metric_cards
```

A lower-risk first version can avoid new commands and implement this as preset workflow/templates plus docs:

```bash
playspec create phase-execution "<feature> phase 1" --phase 1 --from <total-plan-task>
playspec prompt
playspec complete ...
```

But the template must still produce a parent-visible ledger proving each phase execution.

## 5. Required Invariants

### 5.1 Exactly N real phase executions

For a parent with `phaseCount: N`, PlaySpec must distinguish these states:

- task created
- prompt rendered
- spec gate passed
- plan gate passed
- implementation started
- validation passed
- final phase evidence written
- phase closed

Only `phase closed` with approval-safe validation counts as one completed mono-spec execution.

Creating a child task id or docs folder must not increment the completed count.

### 5.2 Retrospective evidence is not execution evidence

Evidence produced after later phases or after a full implementation may be attached as audit evidence, but it must be labeled:

```yaml
evidenceTiming: retrospective
countsAsExecutionProof: false
```

Execution-proof evidence must be generated before or during the phase it claims to support:

```yaml
evidenceTiming: in_phase
countsAsExecutionProof: true
```

### 5.3 Phase gate score

Each phase must have a strict validation score.

Default threshold:

```yaml
minimumApprovalScore: 95
```

If a phase scores below threshold:

- the phase remains open;
- the parent remains blocked;
- final PR/report must show approval-safe = no;
- the runner must either fix and rerun or ask for a decision.

### 5.4 Active-path proof

Each phase must define the active path it changes or protects.

Examples:

- backend service path, not only helper function;
- presenter/final JSON path, not only internal row shape;
- frontend render/markdown path, not only parsed fixture type;
- saved assistant output consumed by frontend script when end-to-end proof is required.

Helper-only assertions may supplement, but must not be the sole proof for a user-visible phase.

## 6. Proposed Data Model

### Parent task metadata

Add optional parent orchestration metadata to task YAML or a sidecar ledger file:

```yaml
multiMonoSpec:
  version: 1
  parentTaskId: github_issue_305_reorder_risk_metric_cards
  totalSpecPath: docs/features/.../total_spec.md
  phasePlanPath: docs/features/.../phase_plan.md
  phaseCount: 5
  minimumApprovalScore: 95
  phases:
    - phase: 1
      taskId: github_issue_305_metric_cards_fresh_phase1
      status: closed
      score: 97
      approvalSafe: true
      evidencePath: docs/features/github_issue_305_metric_cards_fresh_phase1/execution_evidence.md
    - phase: 2
      taskId: github_issue_305_metric_cards_fresh_phase2
      status: closed
      score: 96
      approvalSafe: true
      evidencePath: docs/features/github_issue_305_metric_cards_fresh_phase2/execution_evidence.md
```

### Phase evidence ledger

Each child phase should write `execution_evidence.md` and optionally machine-readable `execution_evidence.yaml`:

```yaml
phase: 1
taskId: github_issue_305_metric_cards_fresh_phase1
workflowType: mono-spec
parentTaskId: github_issue_305_reorder_risk_metric_cards
phaseScope: backend ProductMaster/ProductVariant metric evidence aggregation
evidenceTiming: in_phase
countsAsExecutionProof: true
minimumApprovalScore: 95
score: 97
approvalSafe: true
activePathProof:
  - command: cd be && npm test -- chat-purchase-order-risk-reorder-analysis.spec.ts
    assertion: analyze() emits metric evidence for every evaluated product and active variant
artifacts:
  spec: docs/features/github_issue_305_metric_cards_fresh_phase1/spec.md
  plan: docs/features/github_issue_305_metric_cards_fresh_phase1/plan.md
  result: docs/features/github_issue_305_metric_cards_fresh_phase1/result.md
  pr: docs/features/github_issue_305_metric_cards_fresh_phase1/pr.md
  validation: docs/features/github_issue_305_metric_cards_fresh_phase1/validation.md
  evidence: docs/features/github_issue_305_metric_cards_fresh_phase1/execution_evidence.md
```

## 7. Template Outputs

Each phase should use this reviewer-facing directory shape:

```text
docs/features/<feature_slug>_phase<k>/
  spec.md
  plan.md
  result.md
  pr.md
  validation.md
  execution_evidence.md
```

### `validation.md`

Required sections:

- phase scope
- pre-implementation score and blockers
- implementation validation commands
- post-implementation verifier score
- active-path proof
- unresolved assumptions
- approval-safe yes/no

### `execution_evidence.md`

Required sections:

- task id
- workflow type
- phase number
- parent total spec and phase plan paths
- prompt/evidence/snapshot paths from `.playspec` when available
- timing classification: `in_phase` or `retrospective`
- whether it counts as execution proof
- exact command transcript summary

### Parent `final_report.md`

The parent workflow should produce a final report with a required table:

| Phase | Task id | Evidence | Score | Active-path proof | Approval-safe |
| --- | --- | --- | ---: | --- | --- |
| 1 | `<task>` | `<path>` | 97 | `<summary>` | yes |

The final report must explicitly say if any phase is retrospective-only or below threshold.

## 8. Workflow Design

### Parent workflow phases

Proposed `multi-mono-spec.yaml` phases:

1. `parent_spec_review`
   - verify total spec and phase plan exist;
   - identify N phases and phase scopes.
2. `phase_task_prepare`
   - create or list expected child phase task ids;
   - write initial parent ledger with all phases pending.
3. `phase_execution_gate`
   - prompt says: run the next pending child phase as mono-spec;
   - parent cannot advance if child is not closed and approval-safe.
4. `phase_ledger_update`
   - import child evidence summary into parent ledger.
5. Loop back to `phase_execution_gate` until all phases complete.
6. `final_validation`
   - run cross-phase validation/build validator.
7. `final_report`
   - generate PR-ready phase table and approval-safe status.

### Child workflow additions

The child mono-spec template should accept these variables:

- `PARENT_TASK_ID`
- `TOTAL_SPEC_FILE`
- `PHASE_PLAN_FILE`
- `PHASE_NUMBER`
- `PHASE_SCOPE`
- `MINIMUM_APPROVAL_SCORE`
- `PHASE_EVIDENCE_FILE`
- `PHASE_VALIDATION_FILE`

The child template should remind the runner:

> Do not complete this phase if score is below `MINIMUM_APPROVAL_SCORE`. Do not count retrospective evidence as execution proof.

## 9. CLI / Core Integration Options

### Option A: Template-only first iteration

- Add workflow/template assets under `src/preset/assets/default`.
- Add docs and examples.
- Require humans/agents to create child phase tasks explicitly.

Pros:

- low implementation risk;
- no new task schema required;
- can ship quickly.

Cons:

- enforcement remains mostly prompt/template based;
- easy to bypass with manual claims.

### Option B: Ledger-aware core support

- Add optional `multiMonoSpec` metadata to task schema.
- Add ledger update helpers.
- Add status/report command.
- Validate `countsAsExecutionProof` and score threshold before parent completion.

Pros:

- stronger process integrity;
- less reliance on agent honesty;
- parent status can be machine-checked.

Cons:

- larger implementation;
- requires schema/tests/CLI updates.

### Recommendation

Ship Option A as the first PlaySpec update, but design the docs and file names to be compatible with Option B. Then add Option B once the template proves useful.

## 10. Use Case: Issue #305 Five-Pass Execution

The issue #305 process is the canonical example.

Input:

- total spec: `docs/features/github_issue_305_reorder_risk_product_variant_metric_cards/github_issue_305_reorder_risk_product_variant_metric_cards_total_spec.md`
- phase plan: `docs/features/github_issue_305_reorder_risk_product_variant_metric_cards/github_issue_305_reorder_risk_product_variant_metric_cards_phase_plan.md`
- required phase count: 5

Phase mapping:

1. backend ProductMaster/ProductVariant metric evidence aggregation;
2. public `purchaseOrderRisk` contract and presenter strengthening;
3. `ORDER_NOW` contradiction guard;
4. frontend card and markdown metric rendering;
5. active-path validation and durable guardrails.

Observed successful evidence pattern:

- Phase 1 initially scored below threshold, was fixed, and later passed at 97.
- Phase 3 initially scored 94 because proof was too helper-level, then active `analyze()` path proof was added and the phase passed at 96.
- Phase 4 initially scored 92 because not-evaluable/excluded variants and compact rendering were incomplete, then passed at 98.
- Phase 5 initially required stronger backend saved JSON -> frontend render/markdown proof, then passed at 96.

This is exactly the behavior the template should encourage: below-threshold phases stop, get fixed, and rerun before the parent advances.

## 11. Acceptance Criteria

A PlaySpec implementation of this spec is acceptable when:

- users can create or follow a documented multi mono-spec workflow from a total spec and phase plan;
- each phase has deterministic task ids and reviewer-facing evidence files;
- a parent ledger/report distinguishes pending, retrospective-only, failed, and approval-safe phases;
- final report generation refuses or clearly blocks completion when any phase score is below 95;
- docs include the issue #305 five-pass use case;
- tests cover at least:
  - all phases approval-safe -> parent final report ready;
  - one phase score 94 -> parent blocked;
  - retrospective evidence -> parent blocked as execution proof;
  - task id/folder exists without closed phase -> parent blocked.

## 12. Open Questions

1. Should `multi-mono-spec` be a first-class workflow id or a documented pattern built from `total-plan` + `phase-execution`?
2. Should evidence ledgers be markdown-only, YAML-only, or both?
3. Should PlaySpec enforce the 95 threshold globally, per workflow, or per parent task?
4. Should parent workflows create child tasks automatically, or should agents/humans create them phase by phase?
5. Should final PR table generation be a PlaySpec command or a template prompt output?

## 13. Implementation Plan Draft

Recommended first PR:

1. Add docs for `multi-mono-spec` usage and issue #305 example.
2. Add default templates for `validation.md`, `execution_evidence.md`, and parent `final_report.md`.
3. Add a preset workflow that guides parent orchestration without core schema changes.
4. Add tests proving prompts render with parent/phase variables and required file paths.

Recommended second PR:

1. Add optional ledger schema.
2. Add `playspec multi-mono-spec status` and `final-report` commands.
3. Enforce approval threshold and retrospective evidence blocking in core.
4. Add integration tests for blocked/ready parent states.
