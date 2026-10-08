# Implementation plan

1. Extend report schema with optional explicit cause and evolution metadata.
2. Add structured report extraction and enforce configured thresholds/result/cause constraints.
3. Wire Core capture to report snapshots and update built-in settings/prompt guidance.
4. Add real-output versus prompt-example regressions and run feedback/MCP suites; build.

## Verification gate

Built-in validation captures actual report scores even if the prompt includes misleading or invalid score examples. A revision report under 90 creates a negative signal; threshold and approval result stay separate. Missing cause records an explicit capture failure while the gate remains enforced. Existing custom feedback/extractor/MCP tests remain compatible.

Run focused regressions and TypeScript build before PR preparation. Revisit the spec if tests expose a contract conflict.
