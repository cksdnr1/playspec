# Issue 272 Phase ID Artifact Path Safety Spec

## Scope

Reject filename-unsafe workflow phase IDs before they can reach completion, evidence, snapshot, review, rollback, harness, or feedback artifact code. Keep existing artifact filenames unchanged for already-safe phase IDs such as `1`, `validation`, and `tech_spec_draft`.

Out of scope: workflow ID redesign, task ID redesign, issue-scope-create report paths, and broad documentation cleanup.

## Use Case Alignment

Workflow authors can define project or user workflows. If a phase ID contains `/`, `..`, backslashes, whitespace, or other filename-unsafe characters, PlaySpec should fail with a clear workflow validation error instead of writing artifacts into nested or misleading paths.

## High-Level Current Implementation Summary

Verified behavior:

- `WorkflowLoader` parses workflow YAML with `WorkflowDefinitionSchema`, validates phase references, and verifies template paths.
- `WorkflowDefinitionSchema` accepts `phaseOrder` entries and `phases` keys as non-empty strings without a filename-safe constraint.
- `PlaySpecCore.completePhase()`, `collectEvidence()`, and `createSnapshot()` resolve the current phase ID, then write task-local artifact paths.
- Snapshot, evidence, review, and rollback safe point IDs interpolate raw `phaseId`.
- Completion markdown filenames already call `safeFilePart(input.phaseId)`.
- Harness state is stored in a single task-level `harness.yaml`; it records `phaseId` as data but does not derive a filename from it.

Inferred behavior:

- Unsafe phase IDs can load successfully when the referenced phase key exists and the template exists.
- A phase ID containing a path separator can produce nested artifact paths under task artifact directories, and `..` can escape the intended subdirectory when passed through `path.join()`.

## Relevant Files Reviewed

- `src/workflow/workflow-loader.ts`: workflow resolution and validation boundary.
- `src/core/schemas.ts`: zod schema for workflow phase order, phase map, feedback phase references, task history, rollback, and harness records.
- `src/core/types.ts`: `PhaseId`, `WorkflowDefinition`, `PhaseDefinition`, history, completion, and rollback types.
- `src/core/playspec-core.ts`: completion, manual evidence/snapshot, review writing, rollback safe point creation, harness state, and completion ledger creation.
- `src/utils/paths.ts`: task, completion, harness, evolution feedback, and evolution context path helpers.
- `tests/integration/workflow-loader.test.ts`: workflow validation coverage.
- `tests/integration/completion-engine.test.ts`: completion artifact and manual artifact coverage.
- `tests/integration/routing.test.ts`: repeated routed phase artifact suffix coverage.

## Active Entry Points And Bypasses

Active entry points:

- `WorkflowLoader.load()`, `resolve()`, and `resolveFromDirectory()` are the workflow loading boundaries used by core, CLI, and tests.
- `PlaySpecCore.completePhase()` writes completion snapshots, evidence, optional review, rollback safe point metadata, completion ledger event, and optional evolution context snapshot.
- `PlaySpecCore.collectEvidence()` writes manual evidence.
- `PlaySpecCore.createSnapshot()` writes manual snapshots.
- `PlaySpecCore.getHarnessStatus()` and `recordHarnessAttempt()` validate phase existence through workflow loading but write only `harness.yaml`.

Bypass paths:

- Direct construction of `WorkflowDefinition` objects in unit tests can bypass `WorkflowLoader`, but production core flows load workflows through `WorkflowLoader`.
- Existing task YAML can contain `currentPhase`; core validates it against the already-loaded workflow, so loader-level phase ID validation is sufficient for normal use.
- Evolution path helpers also interpolate phase IDs into filenames, but completion can only reach them after workflow loading.

## Current Architecture

Workflow YAML is the source of phase IDs. The loader currently enforces:

- safe workflow ID,
- declared workflow ID matching requested directory or registry location,
- phaseOrder references existing phase map keys,
- feedback phase references exist,
- templates are relative and remain under the workflow template directory.

Artifact writing currently assumes phase IDs are safe:

- `snapshots/phase${phaseId}_before_complete.yaml`
- `snapshots/phase${phaseId}_prompt.md`
- `snapshots/phase${phaseId}_manual_task.yaml`
- `evidence/phase${phaseId}_git_status.txt`
- `evidence/phase${phaseId}_git_diff_stat.txt`
- `evidence/phase${phaseId}_changed_files.txt`
- `reviews/phase${phaseId}_review.yaml`
- rollback safe point ID `phase${phaseId}_${timestamp}`

## Verified Behavior

Safe IDs preserve current artifact names. Existing tests expect examples like:

- `snapshots/phase1_before_complete.yaml`
- `snapshots/phasevalidation_visit2_prompt.md`
- `evidence/phase1_manual_git_status.txt`
- `reviews/phase1_review.yaml`
- completion markdown `completions/0001-1-phase_completed.md`

Completion ledger consistency already depends on the raw phase ID remaining in event fields while the markdown filename uses a safe filename part.

## Problems

The validation boundary is too permissive for a value that is later used in filenames. Sanitizing at each writer would reduce escapes, but it introduces collision questions and changes artifact names for currently loadable custom workflows. Rejecting unsafe phase IDs at workflow load time is lower risk for core invariants because it preserves all safe-ID behavior and fails before any artifact mutation.

## Proposed Direction

Add a centralized phase ID validation helper and call it from `WorkflowLoader.validateWorkflowDefinition()`.

Validation contract:

- Phase IDs must be non-empty filename-safe identifiers.
- Allowed characters: ASCII letters, digits, `_`, `.`, and `-`.
- Disallow `.` and `..` as complete phase IDs.
- Disallow path separators by construction, including `/` and `\`.
- Validate both `phaseOrder` entries and all `phases` map keys so unused unsafe keys are rejected too.

Developer-facing error text should name the workflow and phase ID, explain the allowed characters, and mention artifact filename safety.

Completion artifact writers can keep their current filenames because unsafe phase IDs no longer load. Completion markdown should keep using `safeFilePart()` as a defensive boundary for ledger path consistency.

## File-By-File Plan

- `src/workflow/workflow-loader.ts`: add `assertSafePhaseId()` or equivalent near workflow validation; validate all `phaseOrder` entries and `phases` keys before reference/template checks.
- `src/core/errors.ts`: optionally add a typed PlaySpec error for invalid workflow phase IDs if that matches existing error style.
- `tests/integration/workflow-loader.test.ts`: add project/explicit workflow regression for `bad/phase`, `..`, and/or an unsafe phase map key.
- `tests/integration/completion-engine.test.ts`: add or extend coverage that `completePhase()` artifact refs, rollback safe point refs, review refs, and completion ledger refs remain consistent for safe IDs.

## Risks And Open Questions

Risk: rejecting unsafe custom workflow phase IDs is a compatibility break for workflows that previously used path-like IDs. This is acceptable for this issue because safe phase IDs are part of the identifier contract once phase IDs are used as artifact filename components.

Open question: whether to export the validator for future workflow mutation commands. Initial implementation can keep it local to the loader unless another module already needs it.

## Reader Aids

Verified flow:

```mermaid
flowchart LR
  WorkflowYAML --> Loader[WorkflowLoader]
  Loader --> Core[PlaySpecCore]
  Core --> Artifacts[Task artifacts]
```

Proposed flow:

```mermaid
flowchart LR
  WorkflowYAML --> Loader[WorkflowLoader]
  Loader --> Validate[Validate safe phase IDs]
  Validate --> Core[PlaySpecCore]
  Core --> Artifacts[Task artifacts using unchanged safe IDs]
```
