# PlaySpec

PlaySpec is a local TypeScript CLI and MCP workflow engine for managing LLM-assisted development tasks.

It keeps task state in `.playspec/`, renders workflow-specific prompts, records phase completion evidence, and exposes the same core task operations to MCP clients without making MCP depend on the human CLI `HEAD`.

## The Everyday Journey

Use PlaySpec as a small loop around one development task:

```bash
# 1. Initialize the workspace once
playspec init --preset default

# 2. Create a task. mono-spec is the default workflow.
playspec create "CLI Optimize"

# 3. Render the current phase prompt without using the clipboard
playspec prompt --no-copy

# 4. Do the requested work, then complete the phase
playspec complete --no-copy

# 5. At approval gates, choose the route explicitly
playspec complete --result approved --no-copy
playspec complete --result needs_revision --no-copy

# 6. Inspect or switch tasks when needed
playspec status
playspec list-tasks
playspec use <taskId>
```

That is the primary CLI model: create or select one task, render the next prompt, do the deliverable, complete the phase, and repeat.

`playspec --help` is intentionally compact and shows the commands used in this normal loop. Advanced, recovery, archive, evolution, harness, workflow-admin, and deprecated compatibility commands remain callable directly, but they are hidden from root help.

## Requirements

- Node.js `>=22`
- pnpm `9`
- Git repository for evidence, desync, and rollback features

## Install And Build

```bash
corepack enable
pnpm install
pnpm build
```

During local development you can run the CLI without building:

```bash
pnpm dev --help
pnpm dev init --preset default
```

After `pnpm build`, the package exposes:

```bash
playspec --help
playspec-mcp
```

## Core CLI Commands

### Workspace And Tasks

```bash
playspec init --preset default

# Interactive wizard in a TTY
playspec create

# Default workflow is mono-spec
playspec create "My Feature"
playspec create --workflow mono-spec "My Feature"
playspec create "Child Feature" --parent <taskId>
playspec create "Phase 2 Feature" --parent <taskId> --after <taskId>

# Capture a source problem
playspec create "My Feature" --edit
playspec create "My Feature" --from problem.md
cat problem.md | playspec create "My Feature" --stdin

# Inspect and switch task state
playspec list-tasks
playspec current-task
playspec get-task --task <taskId>
playspec get-task --task <taskId> --json
playspec status
playspec status <taskId>
playspec status --task <taskId>
playspec use
playspec use <taskId>
playspec add-context ./notes.md
playspec add-context --edit

# Lightweight task links
playspec link <sourceTaskId> <targetTaskId> --as parent
playspec link <sourceTaskId> <targetTaskId> --as after
playspec link <sourceTaskId> <targetTaskId> --as related
playspec link --to <targetTaskId> --as parent
playspec unlink <sourceTaskId> <targetTaskId>
playspec unlink <sourceTaskId> <targetTaskId> --as after
playspec unlink --to <targetTaskId>
```

`playspec create` writes `.playspec/HEAD`, which is the active task pointer used by human-facing CLI commands when `--task` is omitted. MCP clients do not use CLI `HEAD`.

`playspec use` opens an interactive task selector in a TTY. Use `playspec use <taskId>` for scripts or direct task switching.

### Prompt Rendering

```bash
playspec prompt
playspec prompt --task <taskId>
playspec prompt --no-copy
playspec prompt --write
playspec prompt --print-only
playspec prompt --out prompt.md
playspec specs
playspec specs --path-only
playspec phase <phaseId>
playspec phase <phaseId> --task <taskId>
```

`prompt` renders the current workflow phase and copies it to the clipboard by default. Use `--no-copy` to print the prompt body, `--print-only` for raw prompt output, `--write` to save a prompt snapshot under the task, or `--out <file>` for a selected output file.

### Phase Completion

```bash
playspec complete
playspec complete --task <taskId>
playspec complete --with-review
playspec complete --result <result>
playspec complete --no-copy
```

Completion writes snapshots, Git evidence, and optional review records. For routed approval gates, non-interactive usage must pass `--result <result>`.

After successful completion, `complete` reloads the task and renders the next prompt. Use `complete --no-copy` when clipboard access is not desired.

## Mono-Spec Workflow

`mono-spec` is the default workflow for one complete implementation pass:

1. 기술 명세서 업데이트
2. 기술 교차 검증
3. 기술 명세서 업데이트
4. 구현 계획서 생성
5. 구현 계획서 교차 검증
6. 구현 계획서 업데이트
7. 기술 구현
8. 테스트
9. 리팩토링
10. PR 준비

The two approval gates use routed completion results:

```bash
playspec complete --result approved
playspec complete --result needs_revision
```

Refactor and PR preparation prompts compare the current branch against `TARGET_BRANCH`, which defaults to `origin/master` during rendering.

## Workflows

The default preset includes:

- `mono-spec` — compact spec, validation, implementation, test, refactor, and PR workflow.
- `issue-validate` — GitHub issue validation workflow with a 90 point approval threshold, comment output, and optional body rewrite.
- `multi-spec` — legacy multi-phase feature/spec workflow.
- `simple-bug` — legacy simple bug workflow.
- `phase-execution` — legacy execution workflow for a selected planning phase.
- `total-plan` — larger planning workflow for work that should be split before implementation.

Only the `default` preset is present in this repository.

## Advanced Commands

These command groups remain available by direct invocation but are hidden from root help to keep the normal journey compact:

```bash
playspec workflow --help
playspec harness --help
playspec archive --help
playspec evolution --help
playspec evidence --task <taskId>
playspec snapshot --task <taskId>
playspec desync-check --task <taskId>
playspec rollback --task <taskId>
playspec close --task <taskId>
```

Recovery commands are also direct-use commands:

```bash
playspec phase --set <phaseId> --yes
playspec rewind --steps 1 --yes
```

Deprecated compatibility aliases remain callable but are hidden from root help:

```bash
playspec next      # use playspec prompt
playspec list      # use playspec list-tasks
playspec current   # use playspec current-task
```

`playspec migrate` is deprecated and hidden from the primary CLI workflow. It remains callable for compatibility with historical migration tasks, but new work should start from `playspec create` and explicit context files instead of migration.

## Phase Execution Tasks

Use `phase-execution` when a completed planning task already produced canonical planning files for a feature:

```bash
playspec create --workflow phase-execution "My Feature" --phase 4 --from <planningTaskId>
```

This creates a task titled like `My Feature Phase 4 Execution`, records `target.phaseNumber`, and links planning context refs to the planning task output files.

## MCP Usage

Build first:

```bash
pnpm build
```

Run the stdio MCP server from the workspace root:

```bash
playspec-mcp
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "playspec": {
      "command": "playspec-mcp",
      "cwd": "/path/to/your/repo"
    }
  }
}
```

If the package is not globally linked, point the client at the built file:

```json
{
  "mcpServers": {
    "playspec": {
      "command": "node",
      "args": ["dist/mcp/index.js"],
      "cwd": "/path/to/your/repo"
    }
  }
}
```

Registered MCP tools:

- `playspec_list_tasks`
- `playspec_get_task`
- `playspec_use_session_task`
- `playspec_get_session_task`
- `playspec_render_next_prompt`
- `playspec_render_phase_prompt`
- `playspec_complete_phase`
- `playspec_collect_evidence`
- `playspec_run_state_desync_check`
- `playspec_rollback_state`
- `playspec_add_context`
- `playspec_set_current_phase`
- `playspec_create_snapshot`
- `playspec_plan_rollback`
- `playspec_execute_git_rollback`
- `playspec_get_harness_status`
- `playspec_record_harness_attempt`
- `playspec_reset_harness`
- `playspec_generate_evolution_proposal`
- `playspec_list_evolution_proposals`
- `playspec_get_evolution_proposal`
- `playspec_store_evolution_proposal`
- `playspec_update_evolution_proposal`
- `playspec_append_evolution_evidence`
- `playspec_skip_evolution_proposal`
- `playspec_diff_evolution_proposal`
- `playspec_apply_evolution_proposal`
- `playspec_record_human_edit_observation`
- `playspec_update_human_edit_observation_status`

MCP calls that operate on a task require either `taskId` or `sessionId`. If both are supplied, explicit `taskId` wins. MCP context resolution never reads `.playspec/HEAD`; `HEAD` is CLI-only.

Mutation-heavy MCP tools require explicit confirmation fields: `playspec_execute_git_rollback` requires `confirm: true`, and `playspec_apply_evolution_proposal` requires `approved: true`. Archive and migration operations remain CLI-only.

Typical MCP flow:

```text
playspec_list_tasks
playspec_use_session_task({ "sessionId": "codex-main", "taskId": "my_feature", "adapter": "codex" })
playspec_render_next_prompt({ "sessionId": "codex-main" })
playspec_complete_phase({ "sessionId": "codex-main" })
```

## `.playspec` Layout

```text
.playspec/
  HEAD
  config.yaml
  sessions/
    <sessionId>.yaml
  migrations/
    plans/
      <migrationId>.yaml
    reports/
      <migrationId>_report.yaml
    backups/
      <migrationId>/
    archived/
  tasks/
    active/
      <taskId>/
        task.yaml
        memory.yaml
        prompts/
        evidence/
        snapshots/
        rollback/
        reviews/
    completed/
      <taskId>/
  workflows/
  templates/
  rules/
```

## Architecture

- `src/core/` contains task workflow behavior and receives explicit task IDs where possible.
- `src/cli/` is the human CLI adapter and may resolve `.playspec/HEAD`.
- `src/mcp/` is the MCP adapter and must use `resolveMcpTaskId()`.
- `src/migration/` contains deprecated migration compatibility code.
- `src/storage/` contains the `TaskStore` interface and YAML implementation.
- `src/workflow/` loads and resolves workflow phases.
- `src/template/` resolves variables and renders templates.
- `src/preset/` copies preset assets into `.playspec/`.

Cross-module imports use path aliases such as `#core/*.js`, `#storage/*.js`, `#workflow/*.js`, `#template/*.js`, `#preset/*.js`, `#utils/*.js`, `#mcp/*.js`, and `#migration/*.js`.

## Development

```bash
pnpm test
pnpm build
```

The test suite uses Vitest and includes unit and integration coverage for slug generation, variable resolution, phase resolution, template rendering, task flows, completion/evidence, desync/rollback behavior, routing, migration compatibility, and MCP server context handling.

## License

MIT
