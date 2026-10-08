# Enforce evidence-backed validation approval

## Problem

A validator can pass result:approved without a review, score or blocker check. The 95-point threshold is prompt-only.

## Contract and implementation

Add gate.validation with a configured reportPath, artifactPaths, threshold and approvalResult. A versioned YAML/JSON validation report binds taskId, phaseId, result, score, blockers and per-dimension earned/max/evidence/deductions to SHA-256 hashes of the current evaluated artifacts. Before snapshots or transitions, require report identity/result/hash consistency, positive rubric dimensions totaling 100 and earned points matching score; approved requires threshold and no blockers. Conservative rejection remains allowed. Legacy workflows without gate.validation retain routing behavior. Configure mono-spec and total-plan gates at 95 and issue validation at its existing 90, and document exact report paths/schema in their prompts. Hash checks establish freshness, not objective correctness of model judgments.

## Acceptance and regression coverage

Missing, malformed, low-score, blocker-bearing, mismatched task/phase/result, inconsistent rubric and stale-hash reports reject without history/ledger writes. Valid reports approve; rejection reports route to patching. Threshold 90 issue validation and legacy routing remain compatible. Test CLI/MCP through shared Core enforcement.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
