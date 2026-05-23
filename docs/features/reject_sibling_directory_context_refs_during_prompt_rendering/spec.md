# Reject sibling-directory context refs during prompt rendering

## Scope

Validate GitHub issue #179 against the current codebase and, if needed, tighten prompt-rendering context reference validation so stored task refs cannot escape the workspace via a sibling path that shares the workspace path string prefix.

In scope:
- `src/core/playspec-core.ts` prompt-rendering context-ref validation.
- Regression coverage for persisted task `contextRefs` that point to a sibling directory.
- Existing valid relative context refs inside the workspace.

Out of scope:
- Context-reference storage redesign.
- Workflow template rendering changes.
- Relevant-file discovery changes.
- Artifact or evidence naming changes.

## Use Case Alignment

A task may contain persisted or migrated `contextRefs`. Prompt rendering must trust only refs that resolve inside the workspace. A ref such as `../<workspace-name>-sibling/context.md` must be rejected even when the sibling path begins with the same absolute path string as the workspace root.

## High-Level Current Implementation Summary

Verified behavior in the current branch:
- `PlaySpecCore.renderNextPrompt()` and `renderExplicitPhasePrompt()` both call `assertContextRefsExist()` before resolving and rendering a workflow phase.
- `addContextRef()` rejects absolute paths, resolves the normalized relative path against the workspace root, and calls `isWithinWorkspace()`.
- `assertContextRefsExist()` also rejects absolute paths, resolves stored refs against the workspace root, and calls the same `isWithinWorkspace()` helper before checking file existence.
- `isWithinWorkspace()` uses separator-aware containment: the resolved path must equal the workspace root or start with `workspaceRoot + path.sep`.

## Relevant Files Reviewed

- `src/core/playspec-core.ts`
  - Active entry points: `renderNextPrompt()`, `renderExplicitPhasePrompt()`, `addContextRef()`.
  - Validation helper: `assertContextRefsExist()`.
  - Boundary helper: `isWithinWorkspace()`.
- `tests/integration/init-create-next.test.ts`
  - Existing missing-context regression.
  - Existing sibling-prefix escape regression.
  - Existing valid context-mode rendering tests.

## Active Entry Points And Bypasses

Verified active paths:
- `renderNextPrompt(taskId)` loads the task, verifies it is active, calls `assertContextRefsExist()`, then renders the resolved current phase.
- `renderExplicitPhasePrompt(taskId, phaseId)` follows the same task validation and context-ref existence guard before rendering the requested phase.
- `addContextRef(taskId, contextPath)` applies boundary validation when adding new refs.

Bypass path under review:
- A stored task can already contain `contextRefs` without going through `addContextRef()`, for example via migration, direct YAML edits, or test construction. This is why prompt rendering must validate persisted refs independently.

## Current Architecture

Context refs remain workspace-relative strings on `TaskRecord.contextRefs`. Prompt rendering does not read context bodies directly in `PlaySpecCore`; it validates refs before passing task data into variable rendering. Context-mode rendering later uses these refs for prompt metadata/content, so the pre-render guard is the correct boundary enforcement point.

## Verified Behavior

Verified from code:
- Absolute stored context refs throw `MissingContextRefError`.
- Stored refs resolving outside the workspace throw `MissingContextRefError`.
- Missing stored refs throw `MissingContextRefError`.
- In-workspace refs continue to render.

Verified from tests:
- `tests/integration/init-create-next.test.ts` contains `renderNextPrompt refuses a sibling contextRef path that shares the workspace path prefix`.
- That test creates a temp workspace, creates a sibling directory named with the workspace path prefix plus `-sibling`, stores a `../<sibling>/context.md` ref, and expects `renderNextPrompt()` to throw `MissingContextRefError`.

## Problems

The issue text describes an older vulnerable implementation using `resolved.startsWith(path.resolve(this.workspaceRoot))`. The current branch no longer matches that behavior. The code already uses separator-aware boundary validation for both newly added refs and persisted refs during prompt rendering.

## Proposed Direction

Run the targeted integration test and full validation. If the existing test passes and no vulnerable `startsWith(workspaceRoot)` check remains, treat the implementation as already present on `origin/master` and avoid adding redundant code. If validation fails, patch `assertContextRefsExist()` to use `isWithinWorkspace()` and keep the existing sibling-prefix test.

## File-By-File Plan

- `src/core/playspec-core.ts`
  - No change expected unless validation reveals a regression. Current implementation already calls `isWithinWorkspace()` from `assertContextRefsExist()`.
- `tests/integration/init-create-next.test.ts`
  - No change expected unless the existing sibling-prefix test is insufficient under execution.
- `docs/features/reject_sibling_directory_context_refs_during_prompt_rendering/`
  - Record PlaySpec workflow artifacts for this issue.

## Risks And Open Questions

Risks:
- Low. The current code appears to have already tightened validation.

Open questions:
- Whether GitHub issue #179 is stale because the fix landed in a prior branch or PR.
- Whether a draft PR should be created when no production or test code changes are required. Creating a code-empty PR would add process noise.

## Reader Aids

Vulnerable shape described by the issue:

```ts
resolved.startsWith(path.resolve(this.workspaceRoot))
```

Current verified shape:

```ts
resolvedPath === resolvedWorkspaceRoot || resolvedPath.startsWith(resolvedWorkspaceRoot + path.sep)
```
