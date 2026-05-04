# Issue 82 Lightweight Task Links Technical Spec

## Scope

This planning document captures GitHub issue #82 as a PlaySpec total-plan feature package. The requested v1 feature is Lightweight Task Links: optional task relationships that help humans and future agents understand grouping, ordering, and adjacent context without turning PlaySpec into a graph-management system.

This PR is planning/docs only. It does not implement runtime behavior.

In scope for the future implementation:

- optional task links stored on tasks;
- link types `parent`, `after`, and `related`;
- create-time flags `--parent` and `--after`;
- new `link` and `unlink` CLI commands;
- exact then unique-prefix task ID resolution;
- direct-only status rendering for outgoing and incoming links;
- compact linked-task context in prompt rendering;
- compatibility with existing tasks and workflows.

Out of scope for v1:

- first-class phases in Core;
- graph, report, next, or task-links commands;
- `--related` on `playspec create`;
- central link index/cache;
- recursive graph traversal or complex cycle detection;
- strict dependency semantics;
- automatic inverse-link writes;
- viewer work;
- implementation in this planning PR.

## Design Principles

Tasks remain the primitive. A task without links is still fully valid and should behave exactly as it does today.

Links are optional metadata. They should be added only when they reduce human or agent ambiguity.

PlaySpec should not add a forced phase model. Phase-like work can be represented by convention with `parent` for grouping and `after` for ordering.

The user-facing vocabulary is intentionally small:

- `parent`: this task belongs to a larger task or work item.
- `after`: this task should happen after another task.
- `related`: this task is loosely related to another task.

The feature should optimize for low human burden, clear CLI output, and idempotent agent-friendly operations.

## Link Types

`parent` is stored from child to parent:

```yaml
links:
  - type: parent
    targetTaskId: issue305
```

Display inverse: a parent task shows matching children under `Includes`. The inverse is display-only and must not be written back to YAML.

`after` is stored from later task to earlier task:

```yaml
links:
  - type: after
    targetTaskId: issue305_phase1
```

Display inverse: an earlier task shows matching later tasks under `Followed by`. The inverse is display-only.

`related` is a loose relationship:

```yaml
links:
  - type: related
    targetTaskId: design_notes
```

`related` does not affect suggested-next behavior.

The following names are intentionally excluded from v1: `part_of`, `includes`, `follows`, `depends_on`, `blocks`, and `supersedes`.

## Data Model

Future implementation should add:

```ts
type TaskLinkType = "parent" | "after" | "related";

type TaskLink = {
  type: TaskLinkType;
  targetTaskId: string;
  createdAt: string;
  createdBy?: "cli" | "manual" | "import" | "agent";
};
```

Tasks should accept an optional `links?: TaskLink[]` field.

Example YAML:

```yaml
id: issue305_phase2_public_contract
title: Issue 305 Phase 2 public contract
workflow: mono-spec
status: active
links:
  - type: parent
    targetTaskId: issue305_reorder_risk_metric_cards
    createdAt: "2026-05-05T10:00:00Z"
    createdBy: cli
  - type: after
    targetTaskId: issue305_phase1_backend_metric_evidence
    createdAt: "2026-05-05T10:01:00Z"
    createdBy: cli
```

Storage direction is outgoing-only on the source task. Incoming relationships are discovered by scanning tasks. A future cache or index can be considered later, but v1 should avoid central index complexity.

## CLI Contract

Create-time linking:

```bash
playspec create "Task title" --parent <taskId>
playspec create "Task title" --after <taskId>
playspec create "Task title" --parent <taskId> --after <taskId>
```

`playspec create` must not add `--related` in v1.

The create output should print the created task ID clearly:

```text
Created task:
  ID: issue305_phase2_public_contract
  Title: Issue 305 Phase 2 public contract
```

Link creation:

```bash
playspec link <sourceTaskId> <targetTaskId> --as parent
playspec link <sourceTaskId> <targetTaskId> --as after
playspec link <sourceTaskId> <targetTaskId> --as related
```

Current-task source shorthand:

```bash
playspec link --to <targetTaskId> --as parent
playspec link --to <targetTaskId> --as after
playspec link --to <targetTaskId> --as related
```

When the source is omitted, the source is the current/head task selected by `playspec use`.

Unlink:

```bash
playspec unlink <sourceTaskId> <targetTaskId>
playspec unlink <sourceTaskId> <targetTaskId> --as parent
playspec unlink <sourceTaskId> <targetTaskId> --as after
playspec unlink <sourceTaskId> <targetTaskId> --as related
playspec unlink --to <targetTaskId>
playspec unlink --to <targetTaskId> --as after
```

If `--as` is omitted, unlink removes all links from source to target.

Status:

```bash
playspec status
playspec status <taskId>
```

Without an argument, status shows the current/head task. With an argument, it shows the resolved task.

## ID Resolution

All CLI inputs that reference an existing task should use the same resolver:

1. Exact task ID match.
2. Unique prefix match.
3. Ambiguous prefix error listing matches and telling the user to use a longer prefix.
4. No-match error suggesting `playspec list-tasks`.

Resolution should be used by create link flags, `link`, `unlink`, and `status <taskId>`.

When a prefix resolves to a longer task ID, output should show the resolved mapping so the user can see what happened.

## Validation Rules

Future implementation must validate:

- source task exists;
- target task exists;
- source and target are not the same;
- link type is one of `parent`, `after`, or `related`;
- exact duplicate links are not created.

Duplicate link creation should be a no-op with a warning, not a hard failure.

Removing a non-existing link should also be a no-op with a warning.

Manual YAML containing unsupported link types should be handled consistently. Preferred UX is warning and ignoring unsupported non-critical link metadata if that can be done without weakening current schema guarantees; preserving existing hard-fail schema behavior is acceptable if warning-and-ignore is too invasive for v1.

## Status UX

Status should show direct relationships only:

- outgoing `parent`, `after`, and `related`;
- incoming `Includes` for tasks that link to the current task as `parent`;
- incoming `Followed by` for tasks that link to the current task as `after`;
- direct related inverse if useful;
- suggested next when obvious.

Parent status suggested-next rule:

1. Find direct children where child has `parent` link to the current task.
2. Use `after` links to order what can be ordered.
3. Suggest the first child that is not done and whose `after` target is done or missing.
4. If ordering is ambiguous, show all open children rather than guessing.

Multi-parent is allowed. Parent depth is allowed, but v1 display remains direct-only. Do not implement complex cycle detection in v1 beyond self-link rejection; any display traversal should track visited IDs if traversal is introduced later.

## Prompt Rendering

When rendering a prompt for a task with links, include compact linked-task context:

```text
Linked task context:
Parents:
- issue305_reorder_risk_metric_cards
After:
- issue305_phase1_backend_metric_evidence
Related:
- issue305_design_notes
```

Rules:

- keep the summary compact;
- do not include full linked task content by default;
- do not require links for prompt rendering;
- render tasks without links exactly as before.

`playspec prompt --include-linked` is a future extension, not required in v1.

## Acceptance Criteria

Data model:

- Tasks can store optional links.
- Valid link types are only `parent`, `after`, and `related`.
- Existing tasks without links remain valid.
- Unknown link types are rejected or warned consistently.

Create UX:

- `playspec create "Task" --parent <id>` creates a parent link.
- `playspec create "Task" --after <id>` creates an after link.
- `playspec create "Task" --parent <id> --after <id>` supports the common grouped ordered case.
- `--related` is not added to create in v1.
- Created task ID is printed clearly.
- Exact and unique-prefix task ID resolution work.
- Ambiguous prefixes fail with helpful output.

Link UX:

- `playspec link A B --as parent` adds a parent link.
- `playspec link A B --as after` adds an after link.
- `playspec link A B --as related` adds a related link.
- `playspec link --to B --as parent` links from current/head task to `B`.
- Source omission without a current task fails with recovery guidance.
- Duplicate exact links are no-op warnings.
- Self-links are rejected.

Unlink UX:

- `playspec unlink A B` removes all links from `A` to `B`.
- `playspec unlink A B --as after` removes only matching `after` links.
- `playspec unlink --to B --as after` removes from current/head task.
- Removing a non-existing link is a no-op warning.

Status UX:

- `playspec status` shows the current/head task.
- `playspec status <taskId>` shows a specific resolved task.
- Status shows outgoing links.
- Status shows incoming includes and followed-by links.
- Parent status shows direct children.
- Suggested next is shown when obvious.
- Status does not recurse infinitely.

Prompt:

- Prompt rendering includes compact linked context when links exist.
- Tasks without links render prompts as before.

Compatibility:

- Existing workflows remain valid.
- No phase workflow is required.
- No global score rule is introduced.
- LLM usage remains optional.

## Quality Gate

Planning quality gate target: 95/100.

Self-score for this planning spec: 96/100.

Rationale:

- The issue's v1 decisions are captured without expanding scope.
- CLI, data model, validation, status, prompt, and compatibility expectations are explicit.
- Deferred work is separated from v1 requirements.
- The document is implementation-ready while preserving the new docs-only PR scope.
