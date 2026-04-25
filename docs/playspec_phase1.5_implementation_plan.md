# PlaySpec Phase 1.5 Implementation Plan

## Scope Lock

Phase `1.5` is `Template Renderer Hardening`.

This phase hardens the existing shared render path used by `playspec next` and `playspec phase`.

Deferred:

- markdown preview / browser viewer
- `playspec view`
- completion/evidence/rollback/archive
- MCP
- any Phase `2+` state transition behavior

## Ordered Patch Steps

1. Keep one active render path.
   - Preserve `runNext` / `runPhase` -> `PlaySpecCore` -> workflow resolution -> template rendering.
   - Do not introduce a second renderer path.

2. Add canonical workflow metadata for required variables.
   - Extend workflow phase schema/types with `requiredVariables?: string[]`.
   - Keep ownership at `phases.<phaseId>.requiredVariables`.

3. Validate required variables on the active path.
   - In `PlaySpecCore`, validate the resolved variable map against phase `requiredVariables` before rendering.
   - Fail with an actionable domain error when any required variable is missing or empty.

4. Harden include resolution.
   - Keep include syntax `{{include:path/to/file.md}}`.
   - Normalize include paths against `.playspec`.
   - Reject include paths that escape `.playspec`.
   - Keep circular include detection.
   - Report missing include failures with the include path and parent template path.

5. Enforce unresolved-placeholder policy.
   - After Handlebars render, reject any remaining raw `{{...}}` token in the final output.

6. Align default preset workflows.
   - Add canonical `requiredVariables` lists to shipped workflow YAML files so new workspaces exercise the same contract.

7. Add tests only for Phase `1.5` behavior.
   - missing required variable
   - include path escape rejection
   - unresolved placeholder rejection on final rendered output
   - preserve existing include/cycle render coverage

8. Repair authoritative docs.
   - remove the Phase `1.5` markdown-preview contradiction from `playspec_phase_plan.md`
   - align `playspec_total_spec.md` with workflow `requiredVariables` ownership and render hardening rules
   - update handoff/result records
