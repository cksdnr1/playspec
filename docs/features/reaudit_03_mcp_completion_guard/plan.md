# Implementation plan

Tighten MCP complete schema and runtime checks, update valid test calls with captured phase and stable IDs, add direct and concurrent regressions, document client migration and run full suite.

## Acceptance gate
Schema and direct handler reject missing guards without mutations. Parallel requests for one expected phase advance once; replaying the same request returns the same event. Existing MCP delegation and feedback tests keep valid explicit guards.

Revisit the design if failure injection exposes an inconsistent contract.
