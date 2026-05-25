# Implementation Plan

## Ordered Steps

1. Add failing resolver tests in `tests/unit/variable-resolver.test.ts`.
   - Cover direct reserved collisions for `TASK_ID`, `TASK_TITLE`, `WORKFLOW_TYPE`, `PHASE_NUMBER`, `STEP_NUMBER`, `STEP_ID`, and `STEP_TITLE`.
   - Cover declared defaults referencing `{{PHASE_NUMBER}}` and `{{STEP_ID}}` while task variables contain spoofed values.
   - Keep an assertion that non-reserved task variables still override declared defaults.

2. Update `src/template/variable-resolver.ts`.
   - Define a local reserved engine variable set for the seven metadata keys from the acceptance criteria.
   - Filter those keys out of task variables before passing task variables into `resolveDeclaredDefaults()`.
   - Filter empty values after reserved filtering for the final task override merge, preserving existing empty-string default behavior.
   - Leave `FEATURE_SLUG` overridable because existing code and tests rely on task-provided feature slug values.

3. Run targeted and repository validation.
   - Targeted: `pnpm vitest run tests/unit/variable-resolver.test.ts`.
   - Build: `pnpm build`.
   - Full suite: `pnpm test`.

## Files To Edit

- `src/template/variable-resolver.ts`
- `tests/unit/variable-resolver.test.ts`
- `docs/features/issue_221_reserved_engine_phase_metadata/result.md` during result reporting
- `docs/features/issue_221_reserved_engine_phase_metadata/pr.md` during PR preparation

## Tests To Add Or Update

- Add a unit test showing reserved task variable collisions are ignored in final resolved output.
- Add a unit test showing defaults that reference reserved engine variables use actual task/phase metadata.
- Existing tests that must remain green:
  - default dependency resolution
  - unknown default references
  - circular defaults
  - explicit non-reserved overrides
  - empty task variable handling

No integration test is planned unless unit validation reveals a render-path-specific behavior difference. `PlaySpecCore.renderNextPrompt()` already depends on `VariableResolver.resolve()`, so the resolver unit tests cover the changed contract directly.

## Behavior Trace

Active entry point:

- CLI/Core/render code calls `VariableResolver.resolve(task, phaseId, workflow, definition)`.

State/data update:

- The resolver derives trusted engine metadata from `task`, `phaseId`, and `definition`.
- It removes reserved engine names from task-supplied variables before default resolution and final overrides.

Propagation:

- Returned variables flow into template rendering, workflow defaults, prompt output, and path variables.

Reset/clear:

- No persistent state or reset path changes are involved. Empty task variables continue to clear explicit overrides and allow defaults.

User-visible behavior:

- Rendered prompts and paths report actual task/phase metadata even if a task record contains spoofing variables.
- Non-reserved task variable overrides still render as before.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: task variables currently seed defaults and override final output without reserved-name filtering.
- Bypass path: any caller that invokes the resolver directly is fixed by centralizing the filter inside `VariableResolver.resolve()`.
- Partial migration risk: adding validation only in CLI/Core would miss direct resolver users. The resolver-level filter closes that risk.

## Risks

- Existing task records with reserved-name variables will no longer see those values in rendered outputs. This is intentional and safer than accepting spoofed metadata.
- If future engine metadata keys need protection, the reserved set must be extended deliberately.

## Rollback Notes

Rollback is a single-code-path revert in `src/template/variable-resolver.ts` plus removal of the two added tests. No data migration or persisted format change is involved.

## Completion Criteria

- Reserved engine variable collisions cannot change final resolver output.
- Defaults referencing reserved engine variables resolve from derived metadata.
- Explicit non-reserved task variable overrides still work.
- Targeted resolver tests, build, and full test suite pass.
