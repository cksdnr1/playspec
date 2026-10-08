# Implementation plan

1. Add complete workflow graph validation in WorkflowLoader before template reads.
2. Make Core termination explicit and propagate invalid PhaseNotFoundError.
3. Add loader and completion regressions; run routing/editor suites and build.

## Verification gate

Reject missing next targets, missing/extra result mappings, empty/duplicate order and references outside order; accept valid loops and next:null. A malformed workflow must leave task state and completion ledger untouched.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
