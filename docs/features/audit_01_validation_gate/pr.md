# Enforce evidence-backed validation approval

Task: `audit_01_validation_gate`
Branch: `fix/audit-01-validation-gate`
Base: `master`

Built-in mono-spec/total-plan approval now requires a current structured report with configured rubric arithmetic, score >=95, no blockers and SHA-256 bindings to evaluated artifacts; issue validation preserves 90. Missing/stale/mismatched reports reject before snapshots or state changes. Completed reports are snapshotted and referenced in completion events. Legacy opt-in policy is documented in docs/validation-reports.md. Validation: 231 gate/loader/routing/MCP/task tests passed plus 33 selected CLI/MCP/evidence regressions; build passed.

See spec.md and plan.md for the behavioral contract and regression scope.
