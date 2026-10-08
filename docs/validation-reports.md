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
artifacts:
  - path: docs/features/example_task/spec.md
    sha256: REPLACE_WITH_64_LOWERCASE_HEX_DIGITS_FROM_THE_CURRENT_FILE
```

The example is not a valid submitted report until its identity, evidence, score and hash are replaced with actual review results. The engine checks schema, rubric arithmetic, identity, artifact freshness and the configured approval rule. It cannot establish the truth of a reviewer's semantic judgments or guarantee an independent reviewer process. Installed workflows must be explicitly updated to adopt new gate policy; custom legacy workflows remain compatible.
