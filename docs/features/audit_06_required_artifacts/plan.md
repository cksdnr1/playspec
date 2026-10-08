# Implementation plan

1. Extend phase/artifact schemas.
2. Add pre-completion file checks.
3. Configure built-in final deliverables and document opt-in phase requirements.
4. Test failure atomicity, canonical boundaries and legacy compatibility; build.

## Verification gate

Missing, empty, directory and external symlink outputs reject before ledger/state changes. Nonempty files pass. Optional artifacts remain optional and final requirements run only on terminal transitions.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
