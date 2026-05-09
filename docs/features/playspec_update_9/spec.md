# PlaySpec Update 9: Markdown Viewer Spec

## Scope

Implement Phase 9 only: a local, read-only markdown viewer for PlaySpec docs and task artifacts.

The viewer must let users inspect markdown in a readable local interface without changing PlaySpec task state, workflow assets, templates, rules, proposals, archive state, or source markdown files.

## Source Inputs

- `docs/features/playspec_evolution/playspec_evolution_phase_plan.md`, Phase 9.
- `docs/features/playspec_evolution/playspec_evolution_total_spec.md`.
- GitHub issue #58 source problem stored in `.playspec/tasks/active/playspec_update_9/sources/source_problem.md`.

## User-Facing Behavior

Add a `playspec view` command.

Supported inputs:

- `playspec view <path>` renders an explicit workspace-relative markdown file.
- `playspec view --task <taskId> --artifact <type>` renders a known task artifact.
- `playspec view --clear-cache` removes generated viewer output only.

Artifact types:

- `source` renders the task source problem when exactly one source file exists.
- `spec`, `plan`, `result`, and `pr` render the task workflow artifact paths when they exist.
- `prompt`, `evidence`, `snapshot`, and `review` render the newest markdown file in that task artifact directory.

Output modes:

- By default, generate an HTML preview under `.playspec/viewer/cache/` and print the generated path.
- With `--open`, open the generated preview in the local browser.
- With `--stdout`, print generated HTML to stdout without writing a cache file.

## Read-Only Boundaries

The viewer may write only generated preview files under `.playspec/viewer/cache/`.

It must not:

- edit source markdown;
- update `task.yaml`, `HEAD`, phase history, evidence, snapshots, reviews, rollback state, or workflow assets;
- participate in prompt rendering, completion, migration, archive, evolution, MCP, or workflow editing callbacks;
- infer an archived task unless an explicit archived task lookup path is requested by the implementation.

## Path Safety

Explicit paths must be workspace-relative markdown files.

Reject:

- absolute paths;
- `..` traversal or normalized workspace escapes;
- symlink escapes after resolving the real path;
- directories;
- non-markdown files for explicit path input.

## Rendering

Use the existing `marked` dependency to render markdown.

Generated HTML should:

- include a small local stylesheet;
- escape metadata values;
- include source path and generated timestamp;
- not fetch remote assets or run user-provided scripts.

## Cache Clearing

`playspec view --clear-cache` removes `.playspec/viewer/cache/` and recreates or leaves the viewer root as needed. It must not delete source docs or other `.playspec` state.

## Tests

Add focused tests proving:

- explicit markdown file viewing creates HTML output;
- task artifact viewing works by task ID and artifact type;
- workspace-escaping paths are rejected;
- viewer commands do not mutate task state;
- cache clear removes only generated viewer cache output.

## Non-Goals

- No web app dashboard.
- No markdown editing.
- No live server.
- No MCP viewer tools.
- No future Phase 10 DAG behavior.
