# Extract feedback from validator reports

## Problem

Built-in mono-spec feedback extracts the validator prompt snapshot, so instructional X/100 examples are parsed instead of actual evaluation output and feedback routinely fails.

## Contract and implementation

Use validation_report as the built-in feedback score source and resolve it to the immutable report snapshot created by the approval gate. Parse its structured score/result/cause rather than fenced examples. Required cause classification is explicit in the report; absent or invalid causes follow the configured nonblocking evolution failure policy without weakening gate enforcement. Derive approval/feedback results and thresholds from the gate/completion/config, reject mismatches and disallowed cause categories, and retain report paths as raw observation references. Legacy custom prompt_snapshot sources remain supported for compatibility and are documented as legacy.

## Acceptance and regression coverage

Built-in validation captures actual report scores even if the prompt includes misleading or invalid score examples. A revision report under 90 creates a negative signal; threshold and approval result stay separate. Missing cause records an explicit capture failure while the gate remains enforced. Existing custom feedback/extractor/MCP tests remain compatible.

## Boundaries

Preserve unrelated user edits, existing task IDs, and public CLI/MCP contracts except the explicitly documented stricter checks. No automatic evolution apply.
