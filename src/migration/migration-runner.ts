import path from 'node:path';
import * as readline from 'node:readline';
import { stringify as stringifyYaml } from 'yaml';
import { TaskRecordSchema } from '#core/schemas.js';
import { PlaySpecError, TaskNotActiveError } from '#core/errors.js';
import type { TaskRecord, TaskContextRef } from '#core/types.js';
import type { TaskStore } from '#storage/task-store.js';
import { readTextFile, writeTextFile, writeTextFileAtomic } from '#utils/fs.js';
import { getTaskRoot } from '#utils/paths.js';
import { resolveContainedPath } from '#utils/contained-path.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { MigrationPlanSchema } from './schemas.js';
import { MigrationStore } from './migration-store.js';
import type {
  MigrationPlan,
  MigrationAction,
  MigrationReport,
  MigrationActionReport,
  AddContextRefAction,
  UpdateTaskStateAction,
  RemoveContextRefAction,
  ArchiveFileAction,
} from './types.js';

export class MigrationValidationError extends PlaySpecError {
  constructor(message: string) {
    super(`Migration plan validation failed: ${message}`);
    this.name = 'MigrationValidationError';
  }
}

export class ArchiveRequiresFlagError extends PlaySpecError {
  constructor(actionId: string) {
    super(
      `Action "${actionId}" is archive_file but --with-archive flag was not provided.`,
      'Pass --with-archive to allow archive operations.'
    );
    this.name = 'ArchiveRequiresFlagError';
  }
}

export class AutoModeConfidenceError extends PlaySpecError {
  constructor(actionId: string, confidence: string) {
    super(
      `Action "${actionId}" has confidence "${confidence}" and cannot be auto-applied. Only "deterministic" confidence actions may run in auto mode.`,
      'Run with --mode review to manually approve this action.'
    );
    this.name = 'AutoModeConfidenceError';
  }
}

// Whitelisted task fields for update_task_state
const ALLOWED_TASK_FIELDS = new Set(['title', 'currentPhase', 'target']);
const TASK_MUTATION_ACTION_TYPES = new Set<MigrationAction['type']>([
  'update_task_state',
  'add_context_ref',
  'remove_context_ref',
]);

export interface MigrationRunnerOptions {
  withArchive?: boolean;
  // Injectable approval function — used in tests; production uses readline
  approveFn?: (action: MigrationAction) => Promise<boolean>;
}

export class MigrationRunner {
  private readonly store: MigrationStore;

  constructor(
    private readonly workspaceRoot: string,
    private readonly taskStore: TaskStore
  ) {
    this.store = new MigrationStore(workspaceRoot);
  }

  async run(
    plan: MigrationPlan,
    options: MigrationRunnerOptions = {}
  ): Promise<{ planPath: string; reportPath: string }> {
    // Validate plan schema
    MigrationPlanSchema.parse(plan);

    // Pre-validate: archive actions require flag
    if (!options.withArchive) {
      for (const action of plan.actions) {
        if (action.type === 'archive_file') {
          throw new ArchiveRequiresFlagError(action.actionId);
        }
      }
    }

    await this.assertTaskMutationTargetIsActive(plan);
    for (const action of plan.actions) await this.validateTarget(plan, action);

    // Persist plan before any mutation
    const planPath = await this.store.savePlan(plan);

    const actionReports: MigrationActionReport[] = [];

    if (plan.mode === 'dry-run') {
      for (const action of plan.actions) {
        actionReports.push({ actionId: action.actionId, type: action.type, status: 'skipped', reason: 'dry-run mode' });
      }
      const report = this.buildReport(plan, actionReports);
      const reportPath = await this.store.saveReport(report);
      return { planPath, reportPath };
    }

    if (plan.mode === 'auto') {
      for (const action of plan.actions) {
        const result = await this.runAutoAction(plan, action, options);
        actionReports.push(result);
      }
    } else {
      // review mode
      for (const action of plan.actions) {
        const result = await this.runReviewAction(plan, action, options);
        actionReports.push(result);
      }
    }

    const report = this.buildReport(plan, actionReports);
    const reportPath = await this.store.saveReport(report);
    return { planPath, reportPath };
  }

  private async assertTaskMutationTargetIsActive(plan: MigrationPlan): Promise<void> {
    if (plan.mode === 'dry-run' || !plan.actions.some(isTaskMutationAction)) {
      return;
    }

    const task = await this.taskStore.getTask(plan.targetTaskId);
    if (task.status !== 'active') {
      throw new TaskNotActiveError(task.id, task.status);
    }
  }

  private async runAutoAction(
    plan: MigrationPlan,
    action: MigrationAction,
    options: MigrationRunnerOptions
  ): Promise<MigrationActionReport> {
    const promotion = action.type === 'update_task_state'
      ? plan.statePromotions.find(sp => sp.fieldPath === action.fieldPath)
      : undefined;
    if (action.type !== 'update_task_state' || action.riskLevel !== 'low' || plan.riskLevel !== 'low' ||
        action.requiresReview || plan.requiresReview || promotion?.requiresReview !== false || promotion.confidence !== 'deterministic' ||
        JSON.stringify(promotion.proposedValue) !== JSON.stringify(action.proposedValue)) {
      return { actionId: action.actionId, type: action.type, status: 'skipped', reason: 'Auto mode requires a low-risk deterministic structured state promotion with no pending review; use review mode.' };
    }

    return this.applyAction(plan, action, options);
  }

  private async runReviewAction(
    plan: MigrationPlan,
    action: MigrationAction,
    options: MigrationRunnerOptions
  ): Promise<MigrationActionReport> {
    if (!action.requiresReview) {
      return this.applyAction(plan, action, options);
    }

    this.printActionPreview(action);

    const approved = options.approveFn
      ? await options.approveFn(action)
      : await this.promptApproval();

    if (!approved) {
      return { actionId: action.actionId, type: action.type, status: 'rejected', reason: 'user rejected' };
    }

    return this.applyAction(plan, action, options);
  }

  private printActionPreview(action: MigrationAction): void {
    const riskLabel = action.riskLevel.toUpperCase();
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Action ${action.actionId} — ${action.type}  [${riskLabel} RISK]`);
    console.log(`  Reason: ${action.reason}`);
    console.log(`  Evidence: ${action.evidence}`);
    if (action.preview) {
      console.log(`\n  Diff:\n${action.preview.split('\n').map((l) => `  ${l}`).join('\n')}`);
    }
    console.log(`${'─'.repeat(50)}`);
  }

  private async promptApproval(): Promise<boolean> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question('  Approve this action? [y/N] ', (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      });
    });
  }

  private async applyAction(
    plan: MigrationPlan,
    action: MigrationAction,
    options: MigrationRunnerOptions
  ): Promise<MigrationActionReport> {
    try {
      await this.validateTarget(plan, action);
      let backupPath: string | undefined;

      if (action.backupRequired || !isTaskMutationAction(action)) {
        const absoluteTarget = await resolveContainedPath(this.workspaceRoot, action.targetPath);
        try {
          backupPath = await this.store.createBackup(plan.id, absoluteTarget);
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        }
      }

      switch (action.type) {
        case 'update_file':
          await this.applyUpdateFile(action.targetPath, action.content);
          break;
        case 'append_section':
          await this.applyAppendSection(action.targetPath, action.sectionContent);
          break;
        case 'replace_section':
          await this.applyReplaceSection(action.targetPath, action.sectionName, action.sectionContent);
          break;
        case 'update_task_state':
          await this.applyUpdateTaskState(plan.targetTaskId, action as UpdateTaskStateAction, plan.id);
          break;
        case 'add_context_ref':
          await this.applyAddContextRef(plan.targetTaskId, action as AddContextRefAction, plan.id);
          break;
        case 'remove_context_ref':
          await this.applyRemoveContextRef(plan.targetTaskId, action as RemoveContextRefAction, plan.id);
          break;
        case 'archive_file':
          await this.applyArchiveFile(action as ArchiveFileAction, options);
          break;
      }

      return { actionId: action.actionId, type: action.type, status: 'applied', backupPath };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { actionId: action.actionId, type: action.type, status: 'failed', reason };
    }
  }

  private async applyUpdateFile(targetPath: string, content: string): Promise<void> {
    const absolutePath = await resolveContainedPath(this.workspaceRoot, targetPath);
    await writeTextFileAtomic(absolutePath, content);
  }

  private async applyAppendSection(targetPath: string, sectionContent: string): Promise<void> {
    const absolutePath = await resolveContainedPath(this.workspaceRoot, targetPath);
    let existing = '';
    try {
      existing = await readTextFile(absolutePath);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : '\n';
    await writeTextFileAtomic(absolutePath, existing + separator + sectionContent);
  }

  private async applyReplaceSection(targetPath: string, sectionName: string, sectionContent: string): Promise<void> {
    const absolutePath = await resolveContainedPath(this.workspaceRoot, targetPath);
    const existing = await readTextFile(absolutePath);
    // Replace markdown section: find "## sectionName\n" and replace until next "## " or EOF
    const sectionHeaderRegex = new RegExp(
      `(^|\n)(##+ ${escapeRegex(sectionName)}\n)([\\s\\S]*?)(?=\n##+ |\n?$)`,
      'i'
    );
    if (!sectionHeaderRegex.test(existing)) {
      // Section not found — append instead
      await writeTextFileAtomic(absolutePath, existing + '\n\n## ' + sectionName + '\n\n' + sectionContent);
    } else {
      const updated = existing.replace(
        sectionHeaderRegex,
        (_match, prefix: string, header: string) => `${prefix}${header}${sectionContent}`
      );
      await writeTextFileAtomic(absolutePath, updated);
    }
  }

  private async applyUpdateTaskState(
    taskId: string,
    action: UpdateTaskStateAction,
    planId: string
  ): Promise<void> {
    const field = action.fieldPath.replace(/^task\.yaml\./, '');

    if (!ALLOWED_TASK_FIELDS.has(field)) {
      throw new MigrationValidationError(
        `Field "${field}" is not allowed for state promotion. Allowed: ${[...ALLOWED_TASK_FIELDS].join(', ')}`
      );
    }

    const task = await this.taskStore.getTask(taskId);
    if (action.previousValue !== undefined && JSON.stringify(task[field as keyof TaskRecord]) !== JSON.stringify(action.previousValue)) {
      throw new MigrationValidationError(`State field "${field}" changed since the migration was planned.`);
    }

    // Backup task.yaml before mutation
    const taskYamlPath = path.join(getTaskRoot(this.workspaceRoot, taskId), 'task.yaml');
    await this.store.createBackup(planId, taskYamlPath);

    const updated: TaskRecord = {
      ...task,
      [field]: action.proposedValue as TaskRecord[keyof TaskRecord],
      updatedAt: new Date().toISOString(),
    };

    // Full schema validation before write
    const validated = TaskRecordSchema.parse(updated);
    await writeTextFileAtomic(taskYamlPath, stringifyYaml(validated));
  }

  private async applyAddContextRef(
    taskId: string,
    action: AddContextRefAction,
    planId: string
  ): Promise<void> {
    const task = await this.taskStore.getTask(taskId);
    const existing = task.contextRefs ?? [];

    const normalizedNew = path.normalize(action.contextRef.path);
    if (existing.some((r) => path.normalize(r.path) === normalizedNew)) {
      // Already present — no-op (not an error)
      return;
    }

    // Backup task.yaml before mutation
    const taskYamlPath = path.join(getTaskRoot(this.workspaceRoot, taskId), 'task.yaml');
    await this.store.createBackup(planId, taskYamlPath);

    const newRef: TaskContextRef = {
      path: action.contextRef.path,
      role: 'planning-context',
      source: action.contextRef.source,
    };

    const updated: TaskRecord = {
      ...task,
      contextRefs: [...existing, newRef],
      updatedAt: new Date().toISOString(),
    };

    const validated = TaskRecordSchema.parse(updated);
    await writeTextFileAtomic(taskYamlPath, stringifyYaml(validated));
  }

  private async applyRemoveContextRef(
    taskId: string,
    action: RemoveContextRefAction,
    planId: string
  ): Promise<void> {
    const task = await this.taskStore.getTask(taskId);
    const existing = task.contextRefs ?? [];
    const normalizedTarget = path.normalize(action.refPath);

    const filtered = existing.filter(
      (r) => path.normalize(r.path) !== normalizedTarget
    );

    if (filtered.length === existing.length) {
      // Ref not found — no-op
      return;
    }

    const taskYamlPath = path.join(getTaskRoot(this.workspaceRoot, taskId), 'task.yaml');
    await this.store.createBackup(planId, taskYamlPath);

    const updated: TaskRecord = {
      ...task,
      contextRefs: filtered,
      updatedAt: new Date().toISOString(),
    };

    const validated = TaskRecordSchema.parse(updated);
    await writeTextFileAtomic(taskYamlPath, stringifyYaml(validated));
  }

  private async applyArchiveFile(action: ArchiveFileAction, options: MigrationRunnerOptions): Promise<void> {
    if (!options.withArchive) {
      throw new ArchiveRequiresFlagError(action.actionId);
    }
    const absolutePath = await resolveContainedPath(this.workspaceRoot, action.targetPath);
    await this.store.archiveFile(absolutePath);
  }

  private async validateTarget(plan: MigrationPlan, action: MigrationAction): Promise<void> {
    const normalized = path.normalize(action.targetPath.replace(/\\/g, '/')).replace(/\\/g, '/');
    await resolveContainedPath(this.workspaceRoot, normalized);
    if (isTaskMutationAction(action)) {
      const expected = path.relative(this.workspaceRoot, path.join(getTaskRoot(this.workspaceRoot, plan.targetTaskId), 'task.yaml')).replace(/\\/g, '/');
      if (normalized !== expected) throw new MigrationValidationError('Structured task actions must target the declared task.yaml.');
    } else if (!['docs/', '.playspec/templates/', '.playspec/rules/'].some(prefix => normalized.startsWith(prefix))) {
      throw new MigrationValidationError(`File target is not allow-listed: ${normalized}`);
    }
    if (action.type === 'add_context_ref') {
      const contextPath = await resolveContainedPath(this.workspaceRoot, action.contextRef.path);
      await readTextFile(contextPath);
    }
    if (action.type === 'update_task_state' && action.fieldPath.replace(/^task\.yaml\./, '') === 'currentPhase') {
      const task = await this.taskStore.getTask(plan.targetTaskId);
      const workflow = await new WorkflowLoader(this.workspaceRoot).load(task.workflow);
      if (action.proposedValue !== null && (typeof action.proposedValue !== 'string' || !workflow.phaseOrder.includes(action.proposedValue))) {
        throw new MigrationValidationError('Proposed currentPhase must exist in the task workflow.');
      }
    }
  }

  private buildReport(plan: MigrationPlan, actionReports: MigrationActionReport[]): MigrationReport {
    const applied = actionReports.filter((r) => r.status === 'applied').length;
    const skipped = actionReports.filter((r) => r.status === 'skipped').length;
    const rejected = actionReports.filter((r) => r.status === 'rejected').length;
    const failed = actionReports.filter((r) => r.status === 'failed').length;

    const summary =
      plan.mode === 'dry-run'
        ? `dry-run: ${plan.actions.length} actions proposed, no mutations applied`
        : `${applied} applied, ${skipped} skipped, ${rejected} rejected, ${failed} failed`;

    return {
      planId: plan.id,
      createdAt: new Date().toISOString(),
      mode: plan.mode,
      targetTaskId: plan.targetTaskId,
      actionReports,
      summary,
    };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTaskMutationAction(action: MigrationAction): boolean {
  return TASK_MUTATION_ACTION_TYPES.has(action.type);
}
