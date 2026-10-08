# Implementation plan

1. Add shared canonical target resolution to EvolutionApplyRunner.
2. Use it before backups, reads and each write.
3. Add external-parent and contained-link regression tests using public proposal/apply APIs.
4. Build and run evolution regressions.

## Acceptance gate
Reproduce the external-parent symlink with an approved executable proposal and assert diff/apply reject without changing external bytes or proposal runtime targets. Check normal apply and internal contained symlink behavior; run existing evolution CLI/MCP regressions and build.

Revisit the design if failure injection exposes an inconsistent contract.
