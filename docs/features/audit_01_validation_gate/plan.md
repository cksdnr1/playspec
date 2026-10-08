# Implementation plan

1. Add validation configuration/report schemas and types.
2. Implement shared report path/identity/hash/rubric checks and call them before completion writes.
3. Declare report variables and gate policies in built-in validation workflows and update prompts/docs.
4. Add engine/CLI/MCP rejection and approval tests and update existing mono-spec fixtures to produce real validation artifacts; build.

## Verification gate

Missing, malformed, low-score, blocker-bearing, mismatched task/phase/result, inconsistent rubric and stale-hash reports reject without history/ledger writes. Valid reports approve; rejection reports route to patching. Threshold 90 issue validation and legacy routing remain compatible. Test CLI/MCP through shared Core enforcement.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
