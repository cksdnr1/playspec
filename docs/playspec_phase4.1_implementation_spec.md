# Dev Phase 4.1 — MCP-Driven Context Migration and State Promotion

## Goal

Migrate fragmented historical project markdown documents into structured PlaySpec state using Claude/MCP for analysis and proposal generation.

Existing repos may contain many legacy planning and result documents:

- `playspec_phase0_implementation_spec.md`
- `playspec_phase1_handoff.md`
- `playspec_phase2_test_result.md`
- `playspec_phase3_implementation_result.md`
- `playspec_total_spec.md`
- `playspec_phase_plan.md`

Phase 4.1 lets Claude/MCP read these documents, infer the current project and task state, and generate a validated `MigrationPlan` that can promote useful context into PlaySpec structures.

**Core principle:**
Claude analyses and proposes. PlaySpec validates, previews, backs up, and applies only authorised plan actions.

---

## Why This Phase Exists

After Dev Phase 4 MCP Adapter is in place, Claude/MCP can read project files through the MCP server. This capability enables a new use case: structured state promotion from unstructured historical documents.

Without Phase 4.1, users who already have planning documents must manually:

1. Identify which files contain relevant context.
2. Manually update `task.yaml` fields such as `title`, `target`, `currentPhase`, `contextRefs`.
3. Decide which historical documents should become master context references.

Phase 4.1 automates the analysis (Claude proposes) and provides safe, reviewable promotion (PlaySpec validates and applies), ensuring users do not lose valuable planning context when starting or resuming a task.

---

## Responsibility Boundary

| Actor | Responsibility |
|---|---|
| Claude / MCP | Read source documents, analyse content, infer structure, propose `MigrationPlan` |
| PlaySpec | Validate plan schema, preview diffs, create backups, apply only authorised actions |
| User | Review plan, approve or reject actions selectively |

Claude **must not** directly mutate files or `task.yaml`. PlaySpec applies only validated, user-approved plan actions.

---

## In Scope

- Bulk markdown reading via MCP tools introduced in Dev Phase 4.
- Claude-assisted document analysis and state inference.
- `MigrationPlan` schema definition and Zod validation.
- State promotion plan generation.
- Migration report generation.
- Diff preview for document and state changes.
- Selective apply in `review` mode.
- Backup before any mutation.
- Optional archive with explicit `--with-archive` flag.
- Persist all migration plans and reports under `.playspec/migrations/`.

### State Promotion Targets

The following `task.yaml` fields may be promoted:

- `task.yaml.title`
- `task.yaml.target`
- `task.yaml.currentPhase`
- `task.yaml.contextRefs`
- `task.yaml.routing` — only if already supported by the active workflow
- Current active task metadata
- Master doc reference: `playspec_total_spec.md`
- Phase plan reference: `playspec_phase_plan.md`

State promotion is higher-risk than document cleanup and must always be gated behind `review` unless confidence is `deterministic` and explicitly allowed.

## Out of Scope

- File deletion (no `delete_file` action type).
- Silent mutation.
- Automatic archive without `--with-archive`.
- Arbitrary shell command execution.
- Code bug fixing during migration.
- External cloud archive.
- Migration without a persisted plan and report.
- Fully automatic state inference without `review` for ambiguous cases.
- Project/Stage state model.
- Rewriting PlaySpec architecture.

---

## Modes

### 1. `review` (Default)

- Generate migration plan.
- Show document diffs and task state changes before applying each action.
- User approves or rejects each action interactively.
- Required for all state promotions (`update_task_state`, `add_context_ref`, `remove_context_ref`) unless confidence is `deterministic` and explicitly overridden.

### 2. `dry-run`

- Generate plan and report only.
- No file mutation.
- No `task.yaml` mutation.
- No archive.
- Plan and report are persisted under `.playspec/migrations/`.

### 3. `auto`

- Explicit opt-in only (`--mode auto`).
- Requires a backup or reversible snapshot before applying.
- May apply only **low-risk validated** actions automatically.
- Must not delete files.
- Must not archive unless `--with-archive` is passed.
- Must not promote ambiguous inferred state.
- If state promotion confidence is `medium` or `low`, downgrade to `review` or fail with a clear message.

---

## CLI

```bash
# Run migration in default review mode
playspec migrate

# Explicit mode selection
playspec migrate --mode review
playspec migrate --mode dry-run
playspec migrate --mode auto
playspec migrate --mode auto --with-archive

# Optional targeting
playspec migrate --source docs/
playspec migrate --task TASK_ID
playspec migrate --target-total-spec docs/playspec_total_spec.md
playspec migrate --target-phase-plan docs/playspec_phase_plan.md
```

---

## MigrationPlan Schema

```yaml
id: "migration_20260425_001"
createdAt: "2026-04-25T10:00:00+09:00"
mode: "review"                          # review | dry-run | auto
sourceRoot: "docs/"
targetTaskId: "login_system_phase_1_execution"

sourceFiles:
  - "docs/playspec_total_spec.md"
  - "docs/playspec_phase_plan.md"
  - "docs/playspec_phase3_implementation_result.md"

targetFiles:
  - ".playspec/tasks/active/login_system_phase_1_execution/task.yaml"
  - "docs/playspec_total_spec.md"

actions:
  - actionId: "action_001"
    type: "update_task_state"
    targetPath: ".playspec/tasks/active/login_system_phase_1_execution/task.yaml"
    sourcePaths:
      - "docs/playspec_phase_plan.md"
    reason: "Phase plan identifies current phase as 3"
    evidence: "Line 42: section heading indicates phase 3 is the active phase"
    riskLevel: "high"
    preview: |
      - currentPhase: "2"
      + currentPhase: "3"
    backupRequired: true
    requiresReview: true

  - actionId: "action_002"
    type: "add_context_ref"
    targetPath: ".playspec/tasks/active/login_system_phase_1_execution/task.yaml"
    sourcePaths:
      - "docs/playspec_total_spec.md"
    reason: "Master spec document identified as primary context reference"
    evidence: "Document title and structure match total spec pattern"
    riskLevel: "medium"
    preview: |
      contextRefs:
        + - path: docs/playspec_total_spec.md
        +   role: planning-context
        +   source: migration_20260425_001
    backupRequired: true
    requiresReview: true

statePromotions:
  - fieldPath: "task.yaml.currentPhase"
    previousValue: "2"
    proposedValue: "3"
    evidenceSources:
      - "docs/playspec_phase_plan.md"
    confidence: "medium"
    reason: "Phase plan section heading and content indicate phase 3 is active"
    requiresReview: true

riskLevel: "high"
requiresReview: true
summary: "2 actions proposed: 1 state promotion (currentPhase), 1 context ref addition"
warnings:
  - "State promotion of currentPhase requires manual verification"
  - "Confidence for currentPhase inference is medium — review required"
```

### Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique migration plan identifier |
| `createdAt` | ISO 8601 | Plan creation timestamp |
| `mode` | enum | `review` \| `dry-run` \| `auto` |
| `sourceRoot` | string | Root directory scanned for source documents |
| `targetTaskId` | string | Target active task ID |
| `sourceFiles` | string[] | Source document paths that were analysed |
| `targetFiles` | string[] | Files that will be mutated if actions are applied |
| `actions` | Action[] | Ordered list of proposed actions |
| `statePromotions` | StatePromotion[] | Structured list of task.yaml field promotions |
| `riskLevel` | enum | `low` \| `medium` \| `high` — overall plan risk |
| `requiresReview` | boolean | Whether the plan as a whole requires interactive review |
| `summary` | string | Human-readable summary of proposed changes |
| `warnings` | string[] | Non-blocking warnings for the user |

---

## Action Types

| Type | Description | Default Risk |
|---|---|---|
| `update_file` | Overwrite or rewrite a document file | medium |
| `append_section` | Append a section to a document | low |
| `replace_section` | Replace a named section in a document | medium |
| `update_task_state` | Mutate a `task.yaml` field | high |
| `add_context_ref` | Add an entry to `task.yaml.contextRefs` | medium |
| `remove_context_ref` | Remove an entry from `task.yaml.contextRefs` | medium |
| `archive_file` | Move a document to `.playspec/migrations/archived/` | high |

**`delete_file` does not exist.** No delete action type is defined or supported.

### Per-Action Fields

Each action must include:

| Field | Type | Description |
|---|---|---|
| `actionId` | string | Unique ID within the plan |
| `type` | enum | One of the action types above |
| `targetPath` | string | File path being mutated |
| `sourcePaths` | string[] | Evidence source files |
| `reason` | string | Why this action is proposed |
| `evidence` | string | Specific evidence (file, line, content excerpt) |
| `riskLevel` | enum | `low` \| `medium` \| `high` |
| `preview` | string | Unified diff or YAML diff of the proposed change |
| `backupRequired` | boolean | Whether a backup must be created before applying |
| `requiresReview` | boolean | Whether this action must be user-approved |

---

## State Promotion Rules

Each state promotion entry must specify:

```yaml
fieldPath: "task.yaml.currentPhase"   # target field path in task.yaml
previousValue: "2"                     # value before promotion
proposedValue: "3"                     # proposed new value
evidenceSources:                       # source files that support the inference
  - "docs/playspec_phase_plan.md"
confidence: "medium"                   # deterministic | high | medium | low
reason: "..."                          # human-readable explanation
requiresReview: true                   # always true unless confidence: deterministic
```

### Confidence Levels

| Level | Meaning |
|---|---|
| `deterministic` | Value is explicitly stated in a single authoritative source with no ambiguity |
| `high` | Strong evidence from multiple sources but requires confirmation |
| `medium` | Reasonable inference from context but ambiguous |
| `low` | Weak or conflicting signals |

### Auto-Apply Rules by Confidence

| Confidence | `auto` mode | `review` mode |
|---|---|---|
| `deterministic` | May apply if explicitly allowed | Show preview and require approval |
| `high` | Must downgrade to review | Show preview and require approval |
| `medium` | Must downgrade to review or fail | Show preview and require approval |
| `low` | Must fail with explanation | Show preview and require approval |

Ambiguous state promotions must never be silently applied.

---

## Backup and Reversibility

- Every mutation creates a backup before applying.
- `task.yaml` mutations generate a timestamped backup at `.playspec/migrations/backups/{plan_id}/`.
- Document file mutations generate a `.bak` copy before overwriting.
- All migration plans and reports are always persisted under `.playspec/migrations/`.
- Migration must be explainable (report) and reversible (backups).

### `.playspec/migrations/` Directory Layout

```
.playspec/migrations/
  plans/
    migration_{timestamp}_{seq}.yaml         # MigrationPlan YAML
  reports/
    migration_{timestamp}_{seq}_report.yaml  # execution report
  backups/
    migration_{timestamp}_{seq}/
      task.yaml.bak
      {escaped_file_path}.bak
  archived/                                  # only with --with-archive
    {escaped_file_path}
```

---

## Safety Rules

1. `review` is the default mode.
2. `dry-run` mutates nothing — generates plan and report only.
3. `auto` must be explicitly opted into with `--mode auto`.
4. Every mutation creates a backup or reversible snapshot before applying.
5. `task.yaml` mutation always requires a diff preview before applying.
6. Ambiguous `currentPhase`, `target`, or active task inference must not be auto-applied.
7. Claude must not directly mutate files.
8. PlaySpec applies only validated, schema-checked plan actions.
9. Archive is optional and requires explicit `--with-archive`.
10. Delete is not a supported action type.
11. All migration plans and reports are persisted under `.playspec/migrations/`.
12. Migration must be explainable and reversible.
13. Do not introduce Project/Stage hierarchy.
14. Do not rewrite PlaySpec architecture.

---

## UX Flow

### `review` mode (default)

```
playspec migrate

Scanning source documents in docs/ ...
  Found 5 markdown files.

Analysing with Claude ...

Migration Plan: migration_20260425_001
Mode: review
Risk: high
2 actions proposed.

──────────────────────────────────────────────
Action 1 of 2 — update_task_state  [HIGH RISK]
  Field:      task.yaml.currentPhase
  Previous:   "2"
  Proposed:   "3"
  Source:     docs/playspec_phase_plan.md
  Confidence: medium
  Evidence:   Section heading at line 42 indicates phase 3 is active.

  Diff:
  - currentPhase: "2"
  + currentPhase: "3"

  Approve this action? [y/N/view evidence]
──────────────────────────────────────────────

Action 2 of 2 — add_context_ref  [MEDIUM RISK]
  File:   docs/playspec_total_spec.md
  Role:   planning-context

  Diff:
  + contextRefs:
  +   - path: docs/playspec_total_spec.md
  +     role: planning-context
  +     source: migration_20260425_001

  Approve this action? [y/N/view diff]
──────────────────────────────────────────────

Applying 1 approved action ...
  Backup created: .playspec/migrations/backups/migration_20260425_001/task.yaml.bak
  Applied: add_context_ref → task.yaml

Plan saved:   .playspec/migrations/plans/migration_20260425_001.yaml
Report saved: .playspec/migrations/reports/migration_20260425_001_report.yaml
```

### `dry-run` mode

```
playspec migrate --mode dry-run

[DRY RUN] No files will be mutated.

Migration Plan: migration_20260425_001
Mode: dry-run
2 actions proposed (no changes applied).

Plan saved:   .playspec/migrations/plans/migration_20260425_001.yaml
Report saved: .playspec/migrations/reports/migration_20260425_001_report.yaml
```

### `auto` mode

```
playspec migrate --mode auto

[AUTO] Applying low-risk validated actions only.
  Skipping: update_task_state (confidence: medium — downgraded to review)
  Applying: add_context_ref (confidence: high — backup created, applying)

Report saved: .playspec/migrations/reports/migration_20260425_001_report.yaml

1 action skipped (requires manual review):
  Run: playspec migrate --mode review --plan migration_20260425_001
```

---

## MCP Integration

Phase 4.1 composes on top of the MCP infrastructure from Dev Phase 4. No new MCP tools are introduced.

Key flow:

1. `playspec migrate` triggers bulk document reading via MCP file access.
2. Document content is passed to Claude for analysis.
3. Claude returns a structured `MigrationPlan` proposal.
4. PlaySpec validates the plan against the `MigrationPlan` Zod schema.
5. PlaySpec applies only approved, validated actions.

Claude reads. Claude proposes. PlaySpec validates. User approves. PlaySpec applies.

---

## Acceptance Criteria

- Phase 4.1 is documented in `docs/playspec_phase_plan.md` after Dev Phase 4.
- `playspec migrate` runs in `review` mode by default.
- `--mode dry-run` generates a plan and report but mutates no files.
- `--mode auto` is explicit and applies only low-risk validated actions.
- `--mode auto` downgrades ambiguous state promotions to `review` or fails with a clear message.
- `update_task_state` and context promotion are `requiresReview: true` unless `confidence: deterministic` and explicitly allowed.
- No `delete_file` action type exists in the plan schema.
- Archive requires `--with-archive`.
- Every mutation creates a backup before applying.
- All plans and reports are persisted under `.playspec/migrations/`.
- `review` mode shows document diffs and task state changes before applying each action.
- State promotion shows `previousValue`, `proposedValue`, `confidence`, and `evidenceSources` before user approval.
- The spec clearly states that Claude proposes and PlaySpec validates/applies.
- Phase 4.1 does not introduce Project/Stage hierarchy.
- Phase 4.1 does not rewrite PlaySpec architecture.
- Documentation only — no runtime code is written in this phase.
