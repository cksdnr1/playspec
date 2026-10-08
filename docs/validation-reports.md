# Evidence-bound validation reports

Built-in mono-spec and total-plan approval gates require a version-1 structured report with score at least 95 and no blockers. Issue validation keeps its 90-point threshold. Other custom workflows opt in with `gate.validation`:

```yaml
gate:
  validation:
    reportPath: "{{SPEC_VALIDATION_FILE}}"
    artifactPaths: ["{{SPEC_FILE}}"]
    threshold: 95
    rubric: {correctness: 30, contracts: 25, failure_handling: 20, testability: 15, scope: 10}
  results: [approved, needs_revision]
  nextByResult:
    approved: implementation
    needs_revision: patch
```

Write YAML or JSON at the configured path before calling CLI or MCP completion. Report the real current task/phase and exact workspace-relative evaluated artifact paths. Hash raw file bytes with SHA-256; any subsequent artifact change requires revalidation. Both approval and revision results require a report. A conservative revision verdict is allowed at any score.

```yaml
version: 1
taskId: example_task
phaseId: tech_spec_validate
result: approved
score: 96
blockers: []
summary: Contracts and failure paths are specified; minor wording gaps remain.
dimensions:
  - name: correctness
    earned: 29
    max: 30
    evidence: ["docs/features/example_task/spec.md: acceptance criteria"]
    deductions: One nonblocking wording ambiguity.
  - name: contracts
    earned: 24
    max: 25
    evidence: ["src/core/playspec-core.ts: completion entry point"]
    deductions: One minor cross-reference is missing.
  - name: failure_handling
    earned: 19
    max: 20
    evidence: ["docs/features/example_task/spec.md: recovery contract"]
    deductions: A nonblocking error-message detail is unspecified.
  - name: testability
    earned: 15
    max: 15
    evidence: ["docs/features/example_task/spec.md: regression scenarios"]
    deductions: ""
  - name: scope
    earned: 9
    max: 10
    evidence: ["docs/features/example_task/spec.md: boundaries"]
    deductions: One nonblocking documentation dependency remains.
cause:
  category: artifact_quality_issue
  confidence: high
  summary: The remaining findings concern artifact completeness; no prompt defect is established.
artifacts:
  - path: docs/features/example_task/spec.md
    sha256: REPLACE_WITH_64_LOWERCASE_HEX_DIGITS_FROM_THE_CURRENT_FILE
```

The example is not a valid submitted report until its identity, evidence, score and hash are replaced with actual review results. The engine checks schema, rubric arithmetic, identity, artifact freshness and the configured approval rule. It cannot establish the truth of a reviewer's semantic judgments or guarantee an independent reviewer process. Installed workflows must be explicitly updated to adopt new gate policy; custom legacy workflows remain compatible.

Mono-spec feedback reads the immutable validation report snapshot and requires an explicit `cause` classification. Approval (95) and evolution feedback (90) remain separate. Legacy custom `prompt_snapshot` feedback sources are still supported for compatibility; new workflows should use `validation_report` with `gate.validation`.

Recovery cannot skip configured validation gates. Before moving to or completing a later phase, the engine requires the latest decision for each preceding validation gate to be approved, with retained evidence and unchanged evaluated inputs. A later `needs_revision` decision supersedes an older approval. Authoring, revalidation and explicit revision destinations remain available. Structured migration phase changes use the same checks; terminal changes in validated workflows must use normal completion.

Each new gate completion retains the exact evaluated artifact bytes and their SHA-256 hashes in task-local review snapshots and completion metadata. Source hashes are rechecked immediately before journaling, and subsequent consuming phases verify both source and snapshot hashes. External editors cannot participate in the task lock: a write after commit does not change the recorded reviewed bytes, and a later consuming phase rejects the changed input. Legacy approvals with a retained validation report use that report for freshness checks; approvals without retained evidence require revalidation.
