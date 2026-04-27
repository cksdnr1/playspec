# PlaySpec

PlaySpec is a local TypeScript CLI and MCP workflow engine for managing LLM-assisted development tasks.

It keeps task state in `.playspec/`, renders phase-specific prompts from workflow templates, records completion evidence, detects drift against Git state, and exposes the same core workflow operations to MCP clients without relying on global CLI `HEAD`.

## Current Status

Implemented through Phase 4.1. The repository currently includes:

- CLI workspace setup and task management.
- YAML-backed task storage.
- Default workflow preset.
- Prompt rendering with required variable validation.
- Canonical `playspec prompt` command with copy-by-default output, file output, and raw print modes.
- Phase completion with snapshots, Git evidence, and optional review records.
- Post-completion next-prompt rendering after `playspec complete`.
- Routed phase completion support through workflow `results` and `nextByResult`.
- Compact context headers for CLI workflow commands.
- Task discovery commands with effective phase display and JSON task output.
- Git state desync checks and safe rollback planning/state rollback.
- MCP stdio server with explicit `taskId` or `sessionId` context resolution.
- Migration plan validation, review/dry-run/auto execution, backups, reports, and optional archive actions.

`playspec prompt` is the current prompt command. `playspec next`, `playspec current`, and `playspec list` remain available as deprecated compatibility aliases.

The current code does not register `playspec view`, `playspec close`, harness automation, or evolution proposal commands. Migration is exposed through `playspec migrate`; MCP-specific migration tools are not registered.

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

## Quick Start

```bash
# Initialize .playspec with the default preset
playspec init --preset default

# Create a task and set .playspec/HEAD for human CLI use
playspec create multi-spec "My Feature"

# Render and copy the active task's next prompt
playspec prompt

# Save the rendered prompt under the task prompts/ directory
playspec prompt --write

# Complete the current phase, then render/copy the next prompt
playspec complete

# Inspect task state
playspec status
```

Available workflows in the default preset:

- `multi-spec` — five-phase feature/spec workflow
- `mono-spec` — ten-step spec, validation, implementation, test, refactor, and PR workflow
- `simple-bug` — two-phase bug workflow
- `phase-execution` — five-phase execution workflow for implementing a numbered phase from prior planning context

Only the `default` preset is present in this repository.

## CLI Usage

### Workspace And Tasks

```bash
playspec init --preset default

# Interactive wizard — guided flow, no flags needed
playspec create

# With editor — opens $EDITOR for the source problem
playspec create mono-spec "Migration Bug Fix" --edit

# From a file — user-friendly shorthand
playspec create mono-spec "Migration Bug Fix" --from problem.md

# Explicit file flag (equivalent to --from without --phase)
playspec create mono-spec "Migration Bug Fix" --from-file ./problem.md

# From stdin — for scripts and automation only
cat problem.md | playspec create mono-spec "Migration Bug Fix" --stdin

playspec list-tasks
playspec current-task
playspec get-task --task <taskId>
playspec get-task --task <taskId> --json
playspec status
playspec status --task <taskId>
playspec use
playspec use <taskId>
playspec add-context ./notes.md
playspec add-context --edit
```

`playspec create` writes `.playspec/HEAD`, which is the active task pointer used by human-facing CLI commands when `--task` is omitted.

`playspec use` opens an interactive active-task selector in a TTY. Use `playspec use <taskId>` for scripts or direct task switching.

`playspec list` and `playspec current` are deprecated compatibility aliases. Prefer `list-tasks` and `current-task` for resolved phase titles, effective first-phase display when a task has not started, and invalid phase diagnostics.

#### Source problem input modes

| Mode | Flag | Best for |
|---|---|---|
| Interactive wizard | `playspec create` (no args) | First-time or exploratory use |
| Editor | `--edit` | Writing or editing a problem description in your preferred editor |
| File | `--from <file>` or `--from-file <file>` | Re-using an existing markdown file |
| Stdin | `--stdin` | Scripts and automation (heredoc, pipe) |

`--from` without `--phase` is treated as a source problem file path. With `--phase`, `--from` specifies a planning task ID (see Phase Execution Tasks below).

Source problem content is stored as an internal markdown file under the task directory and linked as task context. Non-interactive usage (`PLAY_SPEC_NON_INTERACTIVE=1` or no TTY) must use explicit flags and must not hang waiting for input.

### Mono-Spec Workflow

`mono-spec` is the default compact workflow for a complete implementation pass:

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

The two approval gates use existing routed completion results:

```bash
# After step 3
playspec complete --result approved        # continue to implementation plan creation
playspec complete --result needs_revision  # return to technical spec validation

# After step 6
playspec complete --result approved        # continue to implementation
playspec complete --result needs_revision  # return to implementation plan validation
```

Refactor and PR preparation prompts require `TARGET_BRANCH` and default it to `origin/master` during rendering. Those prompts instruct the agent to compare the current branch against `TARGET_BRANCH`, not stale local assumptions.

### Prompt Rendering

```bash
playspec prompt
playspec prompt --task <taskId>
playspec prompt --write
playspec prompt --quiet
playspec prompt --no-copy
playspec prompt --print-only
playspec prompt --out prompt.md
playspec next                 # deprecated alias
playspec phase <phaseId>
playspec phase <phaseId> --task <taskId>
```

`prompt` renders the current workflow phase and copies it to the clipboard by default. Use `--no-copy` to print the prompt body instead, `--print-only` for raw prompt body output without metadata, or `--out <file>` to write a selected output file. Use `--write` to save a prompt snapshot under the task's `prompts/` directory.

`next` is deprecated and kept as a compatibility alias. `phase` renders a specific phase without advancing task state.

### Phase Completion

```bash
playspec complete
playspec complete --task <taskId>
playspec complete --with-review
playspec complete --quiet
playspec complete --result <result>
playspec complete --no-copy
```

Completion writes:

- `snapshots/phase<N>_before_complete.yaml`
- `snapshots/phase<N>_prompt.md`
- `evidence/phase<N>_git_status.txt`
- `evidence/phase<N>_git_diff_stat.txt`
- `evidence/phase<N>_changed_files.txt`
- `reviews/phase<N>_review.yaml` when `--with-review` is used

For routed workflow phases that declare allowed `results`, non-interactive usage must pass `--result <result>`. Interactive terminals are prompted to choose a result.

After successful completion, `complete` reloads the updated task and renders the next prompt using the same copy-by-default behavior as `prompt`. Use `complete --no-copy` to suppress clipboard copying; the command still emits human-readable completion output.

### Evidence And Snapshots

```bash
playspec evidence
playspec evidence --task <taskId>
playspec snapshot
playspec snapshot --task <taskId>
```

`evidence` manually collects Git evidence for the current phase. `snapshot` manually writes the current task snapshot for the current phase.

### Desync And Rollback

```bash
playspec desync-check
playspec desync-check --task <taskId>

playspec rollback
playspec rollback --task <taskId>
playspec rollback --state-only
playspec rollback --git-only --confirm
```

`rollback` without flags prints a rollback plan. `--state-only` restores PlaySpec task state from the last safe point. Git rollback execution requires `--git-only --confirm` and only runs when the computed rollback plan is eligible.

### Migration

```bash
playspec migrate
playspec migrate --mode review
playspec migrate --mode dry-run
playspec migrate --mode auto
playspec migrate --source docs/
playspec migrate --task <taskId>
playspec migrate --plan <plan.yaml>
playspec migrate --target-total-spec docs/playspec_total_spec.md
playspec migrate --target-phase-plan docs/playspec_phase_plan.md
playspec migrate --mode auto --with-archive
```

`playspec migrate` promotes historical markdown documents into structured task context. It resolves the target task from `--task` or CLI `HEAD`, then either loads an external YAML `MigrationPlan` through `--plan` or generates a simple plan from markdown files discovered through `--source`, `--target-total-spec`, and `--target-phase-plan`.

Generated plans currently propose `add_context_ref` actions for markdown files that are not already linked in `task.yaml`. External plans may use the full migration action schema:

- `update_file`
- `append_section`
- `replace_section`
- `update_task_state`
- `add_context_ref`
- `remove_context_ref`
- `archive_file`

`delete_file` is intentionally unsupported.

Migration modes:

- `review` prompts before actions where `requiresReview: true`.
- `dry-run` validates and persists the plan/report without mutating files.
- `auto` applies only actions allowed by the runner; review-required actions are skipped unless their matching state promotion confidence is `deterministic`.

`archive_file` actions require `--with-archive`. Plans are always written before mutation, reports are written after execution, and backups are created for backup-required actions when the target exists.

## Phase Execution Tasks

Use `phase-execution` when a completed planning task already produced the canonical planning files for a feature:

```bash
playspec create phase-execution "My Feature" --phase 4 --from <planningTaskId>
```

This creates a task titled like `My Feature Phase 4 Execution`, records `target.phaseNumber`, and links planning context refs to:

- `<projectDocRoot>/<featureSlug>_total_spec.md`
- `<projectDocRoot>/<featureSlug>_phase_plan.md`

When `--from` is omitted, PlaySpec searches completed planning tasks with a matching title. If multiple matches exist in a non-interactive environment, pass `--from <planningTaskId>`.

## MCP Usage

Build first:

```bash
pnpm build
```

Run the stdio MCP server from the workspace root:

```bash
playspec-mcp
```

Example MCP client command configuration:

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

MCP calls that operate on a task require either `taskId` or `sessionId`. If both are supplied, explicit `taskId` wins. MCP context resolution never reads `.playspec/HEAD`; `HEAD` is CLI-only.

Typical MCP flow:

```text
playspec_list_tasks
playspec_use_session_task({ "sessionId": "codex-main", "taskId": "my_feature", "adapter": "codex" })
playspec_render_next_prompt({ "sessionId": "codex-main" })
playspec_complete_phase({ "sessionId": "codex-main" })
```

## Phase 4.1 Migration Notes

The Phase 4.1 spec in `docs/playspec_phase4.1_implementation_spec.md` is implemented as a CLI migration runner. A Claude/Codex MCP client can still assist by reading legacy docs and producing an external YAML plan, then you can run:

```bash
playspec migrate --plan migration_plan.yaml --mode review
```

The CLI-generated migration path is intentionally conservative: it discovers markdown files and adds missing `contextRefs`. Higher-risk state promotion should be supplied as a reviewed external plan.

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

- `src/core/` contains task workflow behavior and must receive explicit task IDs where possible.
- `src/cli/` is the human CLI adapter and may resolve `.playspec/HEAD`.
- `src/mcp/` is the MCP adapter and must use `resolveMcpTaskId()`.
- `src/migration/` validates and applies migration plans.
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

The test suite uses Vitest and includes unit and integration coverage for slug generation, variable resolution, phase resolution, template rendering, task creation/use/current flows, completion/evidence, desync/rollback behavior, routing, migration, and MCP server context handling.

## License

MIT
