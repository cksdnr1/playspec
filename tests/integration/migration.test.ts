import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { TaskNotActiveError } from '#core/errors.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath, getMigrationPlansDir, getMigrationReportsDir } from '#utils/paths.js';
import { MigrationRunner, MigrationValidationError, ArchiveRequiresFlagError } from '#migration/migration-runner.js';
import { MigrationPlanSchema } from '#migration/schemas.js';
import type { MigrationPlan, MigrationAction } from '#migration/types.js';
import { generateMigrationId } from '#migration/migration-store.js';

let workspace: TempWorkspace;
let taskId: string;
const TASK_TITLE = 'Migration Test Task';

beforeEach(async () => {
  workspace = await createTempWorkspace();
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  const store = new YamlTaskStore(workspace.dir);
  taskId = 'migration_test_task';
  await store.createTask({ id: taskId, title: TASK_TITLE, workflow: 'multi-spec' });
  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

  // Create sample docs
  await writeTextFile(path.join(workspace.dir, 'docs', 'total_spec.md'), '# Total Spec\nContent here.');
  await writeTextFile(path.join(workspace.dir, 'docs', 'phase_plan.md'), '# Phase Plan\nContent here.');
});

afterEach(async () => {
  await workspace.cleanup();
});

function makePlan(
  overrides: Partial<MigrationPlan> = {},
  actionsOverride?: MigrationAction[]
): MigrationPlan {
  const planId = generateMigrationId();
  const taskYamlPath = `.playspec/tasks/active/${taskId}/task.yaml`;
  const actions: MigrationAction[] = actionsOverride ?? [
    {
      actionId: 'action_001',
      type: 'add_context_ref',
      targetPath: taskYamlPath,
      sourcePaths: ['docs/total_spec.md'],
      reason: 'Add total spec as context reference',
      evidence: 'File exists at docs/total_spec.md',
      riskLevel: 'medium',
      preview: '+ contextRefs:\n+   - path: docs/total_spec.md',
      backupRequired: true,
      requiresReview: false,
      contextRef: { path: 'docs/total_spec.md', role: 'planning-context', source: planId },
    },
  ];

  return {
    id: planId,
    createdAt: new Date().toISOString(),
    mode: 'dry-run',
    sourceRoot: 'docs',
    targetTaskId: taskId,
    sourceFiles: ['docs/total_spec.md'],
    targetFiles: [taskYamlPath],
    actions,
    statePromotions: [],
    riskLevel: 'medium',
    requiresReview: false,
    summary: '1 action proposed',
    warnings: [],
    ...overrides,
  };
}

// ─── MigrationPlanSchema validation ──────────────────────────────────────────

describe('MigrationPlanSchema', () => {
  it('rejects delete_file action type', () => {
    const raw = {
      id: 'migration_test',
      createdAt: new Date().toISOString(),
      mode: 'dry-run',
      sourceRoot: 'docs',
      targetTaskId: taskId,
      sourceFiles: [],
      targetFiles: [],
      actions: [
        {
          actionId: 'bad_action',
          type: 'delete_file',  // must be rejected
          targetPath: 'docs/file.md',
          sourcePaths: [],
          reason: 'test',
          evidence: 'test',
          riskLevel: 'high',
          preview: '',
          backupRequired: false,
          requiresReview: true,
        },
      ],
      statePromotions: [],
      riskLevel: 'high',
      requiresReview: true,
      summary: 'test',
      warnings: [],
    };

    expect(() => MigrationPlanSchema.parse(raw)).toThrow();
  });

  it('accepts all valid action types', () => {
    const base = {
      actionId: 'a1',
      targetPath: 'some/file.md',
      sourcePaths: [],
      reason: 'r',
      evidence: 'e',
      riskLevel: 'low' as const,
      preview: '',
      backupRequired: false,
      requiresReview: false,
    };

    const plan = {
      id: 'migration_test',
      createdAt: new Date().toISOString(),
      mode: 'dry-run' as const,
      sourceRoot: 'docs',
      targetTaskId: taskId,
      sourceFiles: [],
      targetFiles: [],
      actions: [
        { ...base, actionId: 'a1', type: 'update_file' as const, content: 'x' },
        { ...base, actionId: 'a2', type: 'append_section' as const, sectionContent: 'x' },
        { ...base, actionId: 'a3', type: 'replace_section' as const, sectionName: 'S', sectionContent: 'x' },
        { ...base, actionId: 'a4', type: 'update_task_state' as const, fieldPath: 'title', previousValue: 'a', proposedValue: 'b' },
        { ...base, actionId: 'a5', type: 'add_context_ref' as const, contextRef: { path: 'docs/f.md', role: 'planning-context' as const, source: 'src' } },
        { ...base, actionId: 'a6', type: 'remove_context_ref' as const, refPath: 'docs/f.md' },
        { ...base, actionId: 'a7', type: 'archive_file' as const },
      ],
      statePromotions: [],
      riskLevel: 'low' as const,
      requiresReview: false,
      summary: 'test',
      warnings: [],
    };

    expect(() => MigrationPlanSchema.parse(plan)).not.toThrow();
  });
});

// ─── Dry-run mode ─────────────────────────────────────────────────────────────

describe('MigrationRunner — dry-run mode', () => {
  it('persists plan and report without mutating task.yaml', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan({ mode: 'dry-run', requiresReview: false });

    const taskBefore = await store.getTask(taskId);
    const runner = new MigrationRunner(workspace.dir, store);
    const { planPath, reportPath } = await runner.run(plan);

    // Plan and report files exist
    await expect(access(planPath)).resolves.toBeUndefined();
    await expect(access(reportPath)).resolves.toBeUndefined();

    // task.yaml is unchanged
    const taskAfter = await store.getTask(taskId);
    expect(taskAfter.contextRefs).toEqual(taskBefore.contextRefs);
    expect(taskAfter.updatedAt).toEqual(taskBefore.updatedAt);
  });

  it('persists plan in .playspec/migrations/plans/', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan({ mode: 'dry-run' });

    const runner = new MigrationRunner(workspace.dir, store);
    const { planPath } = await runner.run(plan);

    const plansDir = getMigrationPlansDir(workspace.dir);
    expect(planPath).toContain(plansDir);
    const content = await readFile(planPath, 'utf-8');
    expect(content).toContain(plan.id);
  });

  it('persists report in .playspec/migrations/reports/', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan({ mode: 'dry-run' });

    const runner = new MigrationRunner(workspace.dir, store);
    const { reportPath } = await runner.run(plan);

    const reportsDir = getMigrationReportsDir(workspace.dir);
    expect(reportPath).toContain(reportsDir);
    const content = await readFile(reportPath, 'utf-8');
    const report = parseYaml(content) as { planId: string; mode: string };
    expect(report.planId).toBe(plan.id);
    expect(report.mode).toBe('dry-run');
  });

  it('marks all actions as skipped in dry-run report', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan({ mode: 'dry-run' });

    const runner = new MigrationRunner(workspace.dir, store);
    const { reportPath } = await runner.run(plan);

    const content = await readFile(reportPath, 'utf-8');
    const report = parseYaml(content) as { actionReports: { status: string }[] };
    expect(report.actionReports.every((r) => r.status === 'skipped')).toBe(true);
  });
});

// ─── Review mode ─────────────────────────────────────────────────────────────

describe('MigrationRunner — review mode', () => {
  it('applies approved add_context_ref action and creates backup', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const planId = generateMigrationId();
    const taskYamlPath = `.playspec/tasks/active/${taskId}/task.yaml`;

    const plan = makePlan(
      {
        id: planId,
        mode: 'review',
        requiresReview: true,
      },
      [
        {
          actionId: 'action_001',
          type: 'add_context_ref',
          targetPath: taskYamlPath,
          sourcePaths: ['docs/total_spec.md'],
          reason: 'Add total spec',
          evidence: 'File exists',
          riskLevel: 'medium',
          preview: '+ docs/total_spec.md',
          backupRequired: true,
          requiresReview: true,
          contextRef: { path: 'docs/total_spec.md', role: 'planning-context', source: planId },
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    const { reportPath } = await runner.run(plan, {
      approveFn: async () => true, // auto-approve for testing
    });

    // Task should have the new context ref
    const taskAfter = await store.getTask(taskId);
    expect(taskAfter.contextRefs).toBeDefined();
    expect(taskAfter.contextRefs!.some((r) => r.path === 'docs/total_spec.md')).toBe(true);
    expect(taskAfter.contextRefs![0].role).toBe('planning-context');
    expect(taskAfter.contextRefs![0].source).toBe(planId);

    // Backup should exist
    const content = await readFile(reportPath, 'utf-8');
    const report = parseYaml(content) as { actionReports: { status: string; backupPath?: string }[] };
    const actionReport = report.actionReports[0];
    expect(actionReport?.status).toBe('applied');
    expect(actionReport?.backupPath).toBeDefined();
    await expect(access(actionReport!.backupPath!)).resolves.toBeUndefined();
  });

  it('rejects action when user rejects', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan(
      { mode: 'review', requiresReview: true },
      [
        {
          actionId: 'action_001',
          type: 'add_context_ref',
          targetPath: `.playspec/tasks/active/${taskId}/task.yaml`,
          sourcePaths: ['docs/total_spec.md'],
          reason: 'Add total spec',
          evidence: 'File exists',
          riskLevel: 'medium',
          preview: '+ docs/total_spec.md',
          backupRequired: true,
          requiresReview: true,
          contextRef: { path: 'docs/total_spec.md', role: 'planning-context', source: 'test-plan' },
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    const { reportPath } = await runner.run(plan, {
      approveFn: async () => false, // reject
    });

    const taskAfter = await store.getTask(taskId);
    expect(taskAfter.contextRefs ?? []).toHaveLength(0);

    const content = await readFile(reportPath, 'utf-8');
    const report = parseYaml(content) as { actionReports: { status: string }[] };
    expect(report.actionReports[0]?.status).toBe('rejected');
  });

  it('does not add duplicate context ref', async () => {
    const store = new YamlTaskStore(workspace.dir);

    // First: add the ref
    await store.updateTask(taskId, {
      contextRefs: [{ path: 'docs/total_spec.md', role: 'planning-context', source: 'existing' }],
    });

    const plan = makePlan(
      { mode: 'review', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'add_context_ref',
          targetPath: `.playspec/tasks/active/${taskId}/task.yaml`,
          sourcePaths: ['docs/total_spec.md'],
          reason: 'Add total spec',
          evidence: 'File exists',
          riskLevel: 'medium',
          preview: '',
          backupRequired: true,
          requiresReview: false,
          contextRef: { path: 'docs/total_spec.md', role: 'planning-context', source: 'test-plan' },
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    await runner.run(plan);

    const taskAfter = await store.getTask(taskId);
    expect(taskAfter.contextRefs).toHaveLength(1); // still 1, no duplicate
  });
});

// ─── Auto mode ────────────────────────────────────────────────────────────────

describe('MigrationRunner — auto mode', () => {
  it('skips medium-confidence update_task_state and includes reason', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan(
      {
        mode: 'auto',
        statePromotions: [
          {
            fieldPath: 'currentPhase',
            previousValue: null,
            proposedValue: 'planning',
            evidenceSources: ['docs/phase_plan.md'],
            confidence: 'medium',
            reason: 'inferred from phase plan',
            requiresReview: true,
          },
        ],
      },
      [
        {
          actionId: 'action_001',
          type: 'update_task_state',
          targetPath: `.playspec/tasks/active/${taskId}/task.yaml`,
          sourcePaths: ['docs/phase_plan.md'],
          reason: 'Update currentPhase',
          evidence: 'Phase plan indicates phase planning',
          riskLevel: 'high',
          preview: '- currentPhase: null\n+ currentPhase: planning',
          backupRequired: true,
          requiresReview: true,
          fieldPath: 'currentPhase',
          previousValue: null,
          proposedValue: 'planning',
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    const { reportPath } = await runner.run(plan);

    const content = await readFile(reportPath, 'utf-8');
    const report = parseYaml(content) as { actionReports: { status: string; reason?: string }[] };
    expect(report.actionReports[0]?.status).toBe('skipped');
    expect(report.actionReports[0]?.reason).toContain('medium');
  });

  it('applies deterministic add_context_ref in auto mode', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const planId = generateMigrationId();
    const plan = makePlan(
      {
        id: planId,
        mode: 'auto',
        requiresReview: false,
      },
      [
        {
          actionId: 'action_001',
          type: 'add_context_ref',
          targetPath: `.playspec/tasks/active/${taskId}/task.yaml`,
          sourcePaths: ['docs/total_spec.md'],
          reason: 'Add total spec',
          evidence: 'File exists',
          riskLevel: 'medium',
          preview: '',
          backupRequired: true,
          requiresReview: false, // not requires review → auto applies
          contextRef: { path: 'docs/total_spec.md', role: 'planning-context', source: planId },
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    await runner.run(plan);

    const taskAfter = await store.getTask(taskId);
    expect(taskAfter.contextRefs?.some((r) => r.path === 'docs/total_spec.md')).toBe(true);
  });
});

describe('MigrationRunner — active task guard', () => {
  it('rejects completed target tasks before applying generated add_context_ref actions', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { status: 'completed' });
    const taskYamlPath = path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'task.yaml');
    const before = await readFile(taskYamlPath, 'utf-8');
    const plan = makePlan({ mode: 'auto', requiresReview: false });

    const runner = new MigrationRunner(workspace.dir, store);

    await expect(runner.run(plan)).rejects.toThrow(`Task "${taskId}" is not active (status: completed).`);
    await expect(readFile(taskYamlPath, 'utf-8')).resolves.toBe(before);
  });

  it('rejects completed target tasks before applying external update_task_state actions', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { status: 'completed' });
    const taskYamlPath = path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'task.yaml');
    const before = await readFile(taskYamlPath, 'utf-8');
    const plan = makePlan(
      { mode: 'auto', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'update_task_state',
          targetPath: `.playspec/tasks/active/${taskId}/task.yaml`,
          sourcePaths: ['docs/phase_plan.md'],
          reason: 'Update title',
          evidence: 'External plan proposes a task title update',
          riskLevel: 'low',
          preview: '- title: Migration Test Task\n+ title: Changed',
          backupRequired: true,
          requiresReview: false,
          fieldPath: 'title',
          previousValue: TASK_TITLE,
          proposedValue: 'Changed',
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);

    await expect(runner.run(plan)).rejects.toThrow(TaskNotActiveError);
    await expect(readFile(taskYamlPath, 'utf-8')).resolves.toBe(before);
  });

  it('allows dry-run task mutation plans for completed target tasks without changing task YAML', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { status: 'completed' });
    const taskYamlPath = path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'task.yaml');
    const before = await readFile(taskYamlPath, 'utf-8');
    const plan = makePlan({ mode: 'dry-run', requiresReview: false });

    const runner = new MigrationRunner(workspace.dir, store);
    const { reportPath } = await runner.run(plan);

    const reportContent = await readFile(reportPath, 'utf-8');
    const report = parseYaml(reportContent) as { actionReports: { status: string; reason?: string }[] };
    expect(report.actionReports[0]?.status).toBe('skipped');
    expect(report.actionReports[0]?.reason).toBe('dry-run mode');
    await expect(readFile(taskYamlPath, 'utf-8')).resolves.toBe(before);
  });
});

// ─── Archive guard ────────────────────────────────────────────────────────────

describe('MigrationRunner — archive guard', () => {
  it('throws ArchiveRequiresFlagError for archive_file without --with-archive', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan(
      { mode: 'review', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'archive_file',
          targetPath: 'docs/old_result.md',
          sourcePaths: [],
          reason: 'Archive old result',
          evidence: 'File is outdated',
          riskLevel: 'high',
          preview: 'Move to .playspec/migrations/archived/',
          backupRequired: true,
          requiresReview: false,
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    await expect(runner.run(plan, { withArchive: false })).rejects.toThrow(ArchiveRequiresFlagError);
  });

  it('archives file when --with-archive is set', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const archiveTarget = path.join(workspace.dir, 'docs', 'old_result.md');
    await writeTextFile(archiveTarget, '# Old Result');

    const plan = makePlan(
      { mode: 'review', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'archive_file',
          targetPath: 'docs/old_result.md',
          sourcePaths: [],
          reason: 'Archive old result',
          evidence: 'File is outdated',
          riskLevel: 'high',
          preview: '',
          backupRequired: false,
          requiresReview: false,
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    await runner.run(plan, { withArchive: true });

    // Source file should be gone
    await expect(access(archiveTarget)).rejects.toThrow();

    // Archived file should exist
    const archivedPath = path.join(
      workspace.dir, '.playspec', 'migrations', 'archived', 'docs_old_result.md'
    );
    await expect(access(archivedPath)).resolves.toBeUndefined();
  });
});

// ─── update_task_state whitelist guard ───────────────────────────────────────

describe('MigrationRunner — update_task_state whitelist', () => {
  it('rejects disallowed field path', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan(
      { mode: 'review', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'update_task_state',
          targetPath: `.playspec/tasks/active/${taskId}/task.yaml`,
          sourcePaths: [],
          reason: 'test',
          evidence: 'test',
          riskLevel: 'high',
          preview: '',
          backupRequired: true,
          requiresReview: false,
          fieldPath: 'workflow', // NOT in whitelist
          previousValue: 'multi-spec',
          proposedValue: 'malicious-type',
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    const { reportPath } = await runner.run(plan);

    const content = await readFile(reportPath, 'utf-8');
    const report = parseYaml(content) as { actionReports: { status: string }[] };
    expect(report.actionReports[0]?.status).toBe('failed');
  });

  it('allows whitelisted title update', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const plan = makePlan(
      { mode: 'review', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'update_task_state',
          targetPath: `.playspec/tasks/active/${taskId}/task.yaml`,
          sourcePaths: [],
          reason: 'Update title',
          evidence: 'From spec',
          riskLevel: 'high',
          preview: '',
          backupRequired: true,
          requiresReview: false,
          fieldPath: 'title',
          previousValue: TASK_TITLE,
          proposedValue: 'New Title',
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    await runner.run(plan);

    const taskAfter = await store.getTask(taskId);
    expect(taskAfter.title).toBe('New Title');
  });
});

// ─── remove_context_ref execution ────────────────────────────────────────────

describe('MigrationRunner — remove_context_ref', () => {
  it('removes an existing context ref from task.yaml', async () => {
    const store = new YamlTaskStore(workspace.dir);

    // Pre-populate a ref so there is something to remove
    await store.updateTask(taskId, {
      contextRefs: [{ path: 'docs/total_spec.md', role: 'planning-context', source: 'existing' }],
    });

    const plan = makePlan(
      { mode: 'review', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'remove_context_ref',
          targetPath: `.playspec/tasks/active/${taskId}/task.yaml`,
          sourcePaths: [],
          reason: 'Remove obsolete ref',
          evidence: 'File no longer relevant',
          riskLevel: 'medium',
          preview: '- docs/total_spec.md',
          backupRequired: true,
          requiresReview: false,
          refPath: 'docs/total_spec.md',
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    await runner.run(plan);

    const taskAfter = await store.getTask(taskId);
    expect(taskAfter.contextRefs ?? []).toHaveLength(0);
  });
});

// ─── Context ref accepted by downstream ──────────────────────────────────────

describe('MigrationRunner — downstream integration', () => {
  it('migration-added contextRefs are accepted by task store getTask', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const planId = generateMigrationId();
    const taskYamlPath = `.playspec/tasks/active/${taskId}/task.yaml`;

    const plan = makePlan(
      { id: planId, mode: 'review', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'add_context_ref',
          targetPath: taskYamlPath,
          sourcePaths: ['docs/total_spec.md'],
          reason: 'Add total spec',
          evidence: 'File exists',
          riskLevel: 'medium',
          preview: '',
          backupRequired: true,
          requiresReview: false,
          contextRef: { path: 'docs/total_spec.md', role: 'planning-context', source: planId },
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    await runner.run(plan);

    // Re-fetch the task — should pass schema validation
    const taskAfter = await store.getTask(taskId);
    expect(taskAfter.contextRefs).toBeDefined();
    const ref = taskAfter.contextRefs!.find((r) => r.path === 'docs/total_spec.md');
    expect(ref).toBeDefined();
    expect(ref!.role).toBe('planning-context');
    expect(ref!.source).toBe(planId);
  });

  it('renderNextPrompt succeeds after migration adds a contextRef pointing to an existing file', async () => {
    // Spec section 12 requires: "playspec next --task does not fail for missing ref"
    const store = new YamlTaskStore(workspace.dir);
    const planId = generateMigrationId();
    const taskYamlPath = `.playspec/tasks/active/${taskId}/task.yaml`;

    const plan = makePlan(
      { id: planId, mode: 'review', requiresReview: false },
      [
        {
          actionId: 'action_001',
          type: 'add_context_ref',
          targetPath: taskYamlPath,
          sourcePaths: ['docs/total_spec.md'],
          reason: 'Add total spec',
          evidence: 'File exists',
          riskLevel: 'medium',
          preview: '',
          backupRequired: true,
          requiresReview: false,
          contextRef: { path: 'docs/total_spec.md', role: 'planning-context', source: planId },
        },
      ]
    );

    const runner = new MigrationRunner(workspace.dir, store);
    await runner.run(plan);

    // docs/total_spec.md was created in beforeEach and exists on disk.
    // renderNextPrompt must not throw MissingContextRefError for this ref.
    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);
    expect(prompt).toBeTruthy();
  });
});
