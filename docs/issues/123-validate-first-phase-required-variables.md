# Issue #123: Validate first-phase required variables during task creation

## Problem

`playspec create` can persist a task and set HEAD even when the selected workflow's first phase is missing required variables. The failure is deferred until `playspec prompt` or a later `playspec complete` render path calls Core prompt rendering.

## Scope

Add a create-time preflight for normal task creation that checks the selected workflow's initial phase required variables against the variables that will be stored on the task, including declared workflow and phase defaults. Reuse existing resolver/Core validation behavior where practical so `create`, `prompt`, and `complete` keep one required-variable contract.

## Acceptance Criteria

- `playspec create "<title>" --workflow <workflow>` fails before task persistence when the workflow's initial phase has missing required variables that have no default.
- A failed create-time validation does not update `.playspec/HEAD` and does not leave a new active task directory behind.
- Valid creates with all required variables supplied by `--var` still succeed and store the expected task variables.
- Required variables satisfied by workflow or phase defaults continue to pass without explicit `--var` entries.
- The missing-variable error names the workflow, phase, and missing variables consistently with prompt rendering.

## Test Requirements

- Add CLI coverage for a workflow whose first phase requires a custom variable and assert `playspec create` fails without persisting the task.
- Add CLI coverage proving a complete `--var` set for that workflow succeeds.
- Add coverage for required variables satisfied by workflow or phase defaults.
- Keep existing `prompt` and Core required-variable tests passing.
