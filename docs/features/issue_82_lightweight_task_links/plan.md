# Issue 82 Lightweight Task Links Implementation Plan

## Scope Note

This file is a future implementation plan generated from GitHub issue #82. The current PR is planning/docs only and intentionally does not edit `src/`, `tests/`, package files, lockfiles, dist files, or runtime behavior.

## Ordered Future Implementation Steps

1. Add task link types and schema support.
   - Define `TaskLinkType` as `parent | after | related`.
   - Define `TaskLink` with `type`, `targetTaskId`, `createdAt`, and optional `createdBy`.
   - Add optional `links?: TaskLink[]` to task metadata.
   - Keep existing tasks without `links` valid.
   - Decide whether unsupported manual link types should hard-fail through schema validation or warn and ignore.

2. Add a reusable task ID resolver.
   - Resolve exact task IDs first.
   - Fall back to unique prefix matches.
   - Fail ambiguous prefixes with a match list and "Use a longer prefix."
   - Fail missing IDs with "No task found" and suggest `playspec list-tasks`.
   - Use this resolver consistently for create link flags, `link`, `unlink`, and `status <taskId>`.

3. Add create-time link flags.
   - Add `--parent <taskId>`.
   - Add `--after <taskId>`.
   - Do not add `--related` to create in v1.
   - Resolve target IDs before writing the new task.
   - Validate target existence.
   - Print the created task ID clearly and show any resolved prefixes.

4. Add link mutation helpers.
   - Validate source and target existence.
   - Reject self-links.
   - Validate link type.
   - Treat duplicate exact links as no-op warnings.
   - Stamp new links with `createdAt` and `createdBy: cli`.
   - Store only outgoing links on the source task.

5. Add `playspec link`.
   - Support `playspec link <sourceTaskId> <targetTaskId> --as parent|after|related`.
   - Support `playspec link --to <targetTaskId> --as parent|after|related`.
   - When source is omitted, resolve source from the current/head task.
   - If no current task exists, fail with guidance to use `playspec use <taskId>` or pass source explicitly.

6. Add `playspec unlink`.
   - Support `playspec unlink <sourceTaskId> <targetTaskId>`.
   - Support `playspec unlink <sourceTaskId> <targetTaskId> --as parent|after|related`.
   - Support `playspec unlink --to <targetTaskId>` with optional `--as`.
   - If `--as` is omitted, remove all links from source to target.
   - Treat non-existing removals as no-op warnings.

7. Update status rendering.
   - `playspec status` shows current/head task.
   - `playspec status <taskId>` shows a resolved task.
   - Display direct outgoing parents, after, and related links.
   - Display direct incoming includes and followed-by links by scanning tasks.
   - Allow multiple parents and parent depth, but display direct relationships only.
   - Add simple suggested-next behavior for parent tasks using direct children and `after` links.

8. Update prompt rendering.
   - Add compact linked-task context when the rendered task has links.
   - Keep prompts for tasks without links unchanged.
   - Do not include full linked task content by default.

9. Add focused tests.
   - Data model/schema compatibility for tasks with and without links.
   - ID resolution exact, unique-prefix, ambiguous, and no-match cases.
   - Create flags for `--parent`, `--after`, and both together.
   - Absence of `--related` on create.
   - Explicit-source and current-task `link` flows.
   - Explicit-source and current-task `unlink` flows.
   - Duplicate link and missing unlink no-op warnings.
   - Self-link rejection.
   - Status direct outgoing and incoming displays.
   - Suggested-next behavior for ordered children.
   - Prompt rendering with and without links.

10. Validate the real user-visible path.
    - Build the CLI.
    - Run targeted unit/integration tests.
    - Exercise CLI create/link/unlink/status/prompt flows in a temporary workspace.
    - Confirm task YAML contains only outgoing links and no inverse links.
    - Confirm existing workflows and tasks without links still work.

## Expected Files For Future Implementation

Exact files should be re-verified before implementation. Likely candidates:

- `src/core/types.ts`
- `src/core/schemas.ts`
- `src/core/playspec-core.ts`
- `src/storage/task-store.ts`
- `src/storage/yaml-task-store.ts`
- `src/cli/commands/create.ts`
- `src/cli/commands/status.ts`
- `src/cli/commands/prompt.ts`
- `src/cli/commands/link.ts`
- `src/cli/commands/unlink.ts`
- `src/cli/index.ts`
- `tests/cli.test.ts`
- `tests/integration/task-links.test.ts`

## Test Scenario From Issue 82

Scenario: ordered grouped work.

1. Create parent task:

```bash
playspec create "Issue 305 reorder-risk metric cards"
```

2. Create linked child tasks:

```bash
playspec create "Issue 305 Phase 1 backend metrics" --parent issue305
playspec create "Issue 305 Phase 2 API contract" --parent issue305 --after issue305_phase1
playspec create "Issue 305 Phase 3 contradiction guard" --parent issue305 --after issue305_phase2
playspec create "Issue 305 Phase 4 frontend rendering" --parent issue305 --after issue305_phase3
playspec create "Issue 305 Phase 5 final validation" --parent issue305 --after issue305_phase4
```

3. Verify parent status:

```bash
playspec status issue305
```

Expected: includes all five children, shows ordering from `after` links, and suggests the first incomplete child.

4. Mark Phase 1 done using the existing completion flow and verify parent status again.

Expected: Phase 1 is shown done and Phase 2 is suggested next.

5. Use Phase 3 as current task:

```bash
playspec use issue305_phase3
playspec status
```

Expected: status shows parent `issue305`, after `issue305_phase2`, and followed-by `issue305_phase4` if it exists.

6. Add duplicate link:

```bash
playspec link issue305_phase3 issue305_phase2 --as after
```

Expected: no-op warning and no duplicate task metadata.

7. Remove link:

```bash
playspec unlink issue305_phase3 issue305_phase2 --as after
```

Expected: link removed and status no longer shows that after relationship.

## Risks And Controls

- Risk: scope expands into graph management. Control: no graph/report/recursive traversal in v1.
- Risk: create command becomes too broad. Control: only `--parent` and `--after`; no `--related`.
- Risk: inverse relationships cause duplicate YAML state. Control: display inverses only.
- Risk: prefix resolution guesses wrong. Control: exact first, unique prefix only, ambiguity error otherwise.
- Risk: current-task source shorthand hides missing state. Control: explicit helpful error when no current task exists.
- Risk: status suggested-next becomes a scheduler. Control: direct children only and simple ordered-child rule.

## Quality Gate

Planning quality gate target: 95/100.

Self-score for this implementation plan: 96/100.

Rationale:

- The plan maps each issue acceptance area to an implementation step.
- Real CLI behavior validation is included rather than relying only on internal fields.
- Scope boundaries and risks are explicit.
- The current PR remains docs-only.
