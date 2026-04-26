# PlaySpec Dev Phase 4.1 Implementation Result — MCP-Driven Context Migration

## Phase Summary

Dev Phase 4.1 adds a migration runner for promoting historical markdown documents into structured PlaySpec task state. The CLI command is registered as `playspec migrate`.

The implementation keeps the high-risk analysis boundary explicit: Claude/Codex may read legacy docs and produce a YAML `MigrationPlan`, while PlaySpec validates, persists, previews, backs up, and applies only supported plan actions.

## Implemented Surface

### CLI

```bash
playspec migrate
playspec migrate --mode review
playspec migrate --mode dry-run
playspec migrate --mode auto
playspec migrate --source docs/
playspec migrate --task TASK_ID
playspec migrate --plan migration_plan.yaml
playspec migrate --target-total-spec docs/playspec_total_spec.md
playspec migrate --target-phase-plan docs/playspec_phase_plan.md
playspec migrate --mode auto --with-archive
```

Registered in:

- `src/cli/index.ts`
- `src/cli/commands/migrate.ts`

### Migration Modules

- `src/migration/types.ts` — migration plan/report/action types
- `src/migration/schemas.ts` — Zod validation schemas
- `src/migration/migration-store.ts` — plan/report persistence, backups, archive storage
- `src/migration/migration-runner.ts` — dry-run/review/auto execution and action application

### Persisted Files

Migration files are written under:

```text
.playspec/migrations/
  plans/<migrationId>.yaml
  reports/<migrationId>_report.yaml
  backups/<migrationId>/
  archived/
```

Plans are saved before mutation. Reports are saved after execution. Backups are created for backup-required actions when the target file exists.

## Supported Action Types

Implemented action types:

- `update_file`
- `append_section`
- `replace_section`
- `update_task_state`
- `add_context_ref`
- `remove_context_ref`
- `archive_file`

`delete_file` is intentionally unsupported and rejected by schema validation.

## Modes

### `review`

Default mode. Actions with `requiresReview: true` print a preview and ask for approval before applying.

### `dry-run`

Validates and persists the plan/report. All actions are reported as skipped and no files are mutated.

### `auto`

Applies only actions allowed by the runner. Review-required actions are skipped unless their matching state promotion confidence is `deterministic`.

## State Promotion Safety

`update_task_state` is restricted to these task fields:

- `title`
- `currentPhase`
- `target`

Task mutations are validated against `TaskRecordSchema` before writing `task.yaml`.

Context reference actions mutate `task.yaml.contextRefs` and validate the full task record before write.

`archive_file` is blocked unless `--with-archive` is passed.

## Generated Plan Behavior

When `--plan` is not provided, `playspec migrate` discovers source markdown files from:

- `--source <path>`
- `--target-total-spec <file>`
- `--target-phase-plan <file>`

The built-in generator currently proposes `add_context_ref` actions for discovered markdown files that are not already present in the target task's `contextRefs`.

Higher-risk document rewrites or task state promotions should be provided through an external YAML migration plan and run in `review` mode.

## MCP Boundary

Phase 4.0 MCP tools remain available for task inspection and workflow execution. Phase 4.1 does not add dedicated MCP migration tools. MCP clients can still assist by reading repository documents and producing an external `MigrationPlan` file for the CLI runner.

## Documentation Updates

Updated:

- `README.md`
- `docs/playspec_phase4.1_implementation_result.md`

The README now documents:

- Implemented `playspec migrate` command and flags.
- Migration modes.
- Supported action types.
- Plan/report/backup/archive locations.
- MCP-assisted external plan workflow.
- Current limitation that generated plans only add missing context refs.

## Validation

Commands run:

```bash
corepack pnpm build
corepack pnpm test
```

Results:

- Build: passed
- Tests: 14 files passed, 133 tests passed

Migration-specific coverage exists in:

- `tests/integration/migration.test.ts`

## Current Limitations

- No dedicated MCP migration tools are registered.
- Built-in plan generation is conservative and only proposes missing `add_context_ref` actions.
- Rich document analysis and high-risk state promotion depend on an external plan, typically produced with LLM assistance and reviewed by the user.
