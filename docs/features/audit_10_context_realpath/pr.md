# Enforce real context and template boundaries

Task: `audit_10_context_realpath`
Branch: `fix/audit-10-context`
Base: `master`

Canonical context/template/include containment now rejects escaping and dangling symlinks while preserving internal links. Validation: context regressions 2 passed; existing template tests 10 and task/context tests 58 passed; build passed. The initial regression assertion expected the wrong domain-error wording and was corrected before the passing rerun.

See spec.md and plan.md for the behavioral contract and regression scope.
