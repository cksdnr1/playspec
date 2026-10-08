# Implementation plan

1. Add recursive content manifests and semantic/template drift diagnostics.
2. Record baseline on new preset installs.
3. Add safe preview/apply CLI, conflict handling, active-task checks, backups and update reports.
4. Test safeguards, build and run full regression suite.
5. Review and apply installed PJ/main/user workflow diffs with backups.

## Verification gate

Detect prompt-only and gate-only drift. Preview never mutates. Safe baseline updates succeed with backups and remain idempotent. Customized files abort unchanged unless named explicitly. Invalid workflow and incompatible active phases reject before writes.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
