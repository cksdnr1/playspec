import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { VariableResolver } from '#template/variable-resolver.js';
import { TemplateRenderer } from '#template/template-renderer.js';
import type { TaskStore } from '#storage/task-store.js';
import {
  MissingRequiredVariablesError,
  TaskNotActiveError,
  GitEvidenceCollectionError,
  PhaseNotFoundError,
} from '#core/errors.js';
import { GitState, statusEntryPathList } from '#core/git-state.js';
import { StateDesyncDetector } from '#core/state-desync-detector.js';
import { RollbackManager } from '#core/rollback-manager.js';
import type {
  PhaseDefinition,
  TaskRecord,
  WorkflowDefinition,
  CompletionResult,
  EvidenceResult,
  SnapshotResult,
  DesyncCheckResult,
  RollbackPlanResult,
  RollbackExecutionResult,
  RollbackSafePoint,
} from '#core/types.js';
import { withWriteLock, writeTextFileAtomic } from '#utils/fs.js';

export class PlaySpecCore {
  private readonly workflowLoader: WorkflowLoader;
  private readonly phaseResolver: PhaseResolver;
  private readonly variableResolver: VariableResolver;
  private readonly templateRenderer: TemplateRenderer;
  private readonly gitState: GitState;
  private readonly stateDesyncDetector: StateDesyncDetector;
  private readonly rollbackManager: RollbackManager;

  constructor(
    private readonly workspaceRoot: string,
    private readonly taskStore: TaskStore
  ) {
    this.workflowLoader = new WorkflowLoader(workspaceRoot);
    this.phaseResolver = new PhaseResolver();
    this.variableResolver = new VariableResolver();
    this.templateRenderer = new TemplateRenderer(workspaceRoot);
    this.gitState = new GitState(workspaceRoot);
    this.stateDesyncDetector = new StateDesyncDetector(this.gitState);
    this.rollbackManager = new RollbackManager(workspaceRoot, taskStore, this.gitState);
  }

  async renderNextPrompt(taskId: string): Promise<string> {
    const task = await this.taskStore.getTask(taskId);
    const workflow = await this.workflowLoader.load(task.workflowType);
    const { phaseId, definition } = this.phaseResolver.resolveCurrentPhase(task, workflow);
    return this.renderResolvedPhase(task, workflow, phaseId, definition);
  }

  async renderExplicitPhasePrompt(taskId: string, phaseId: string): Promise<string> {
    const task = await this.taskStore.getTask(taskId);
    const workflow = await this.workflowLoader.load(task.workflowType);
    const { definition } = this.phaseResolver.resolveExplicitPhase(phaseId, workflow);
    return this.renderResolvedPhase(task, workflow, phaseId, definition);
  }

  async checkTaskDesync(taskId: string): Promise<DesyncCheckResult> {
    const task = await this.taskStore.getTask(taskId);
    return this.stateDesyncDetector.run(task);
  }

  async planRollback(taskId: string): Promise<RollbackPlanResult> {
    const task = await this.taskStore.getTask(taskId);
    return this.rollbackManager.plan(task);
  }

  async rollbackStateOnly(taskId: string): Promise<RollbackExecutionResult> {
    const task = await this.taskStore.getTask(taskId);
    return this.rollbackManager.rollbackStateOnly(task);
  }

  async executeGitRollback(taskId: string): Promise<RollbackExecutionResult> {
    const task = await this.taskStore.getTask(taskId);
    return this.rollbackManager.executeGitRollback(task);
  }

  async completePhase(
    taskId: string,
    options: { withReview?: boolean } = {}
  ): Promise<CompletionResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);

    const workflow = await this.workflowLoader.load(task.workflowType);
    const { phaseId, definition } = this.phaseResolver.resolveCurrentPhase(task, workflow);
    const promptSnapshot = await this.renderResolvedPhase(task, workflow, phaseId, definition);
    const taskRoot = this.getAbsoluteTaskRoot(task);
    const validationTemplate = this.resolveValidationTemplate(definition);

    return withWriteLock(taskRoot, async () => {
      const snapshotFiles = await this.writeSnapshots(
        task,
        phaseId,
        promptSnapshot,
        'completion'
      );
      const evidenceFiles = await this.writeEvidence(task, phaseId, '');
      const reviewFile = options.withReview
        ? await this.writeReview(task, phaseId, validationTemplate)
        : undefined;

      const nextPhase = this.resolveNextPhaseId(task, workflow, phaseId);
      const completedAt = new Date().toISOString();
      const currentGitHead = await this.gitState.getCurrentHead();
      const rollbackSafePoint = this.buildRollbackSafePoint(
        phaseId,
        completedAt,
        currentGitHead,
        snapshotFiles
      );
      const updatedTask = await this.taskStore.completePhase(
        taskId,
        {
          phaseId,
          nextPhase,
          reviewFile,
          evidenceFiles,
          snapshotFiles,
          validationTemplate,
          stateSync: {
            lastKnownGitHead: currentGitHead,
            lastCompletedAt: completedAt,
          },
          rollback: {
            lastSafePoint: rollbackSafePoint,
          },
        }
      );

      return {
        taskId: updatedTask.id,
        completedPhase: phaseId,
        nextPhase: updatedTask.currentPhase,
        status: updatedTask.status,
        evidenceFiles,
        snapshotFiles,
        reviewFile,
      };
    });
  }

  async collectEvidence(taskId: string): Promise<EvidenceResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);

    const workflow = await this.workflowLoader.load(task.workflowType);
    const { phaseId } = this.phaseResolver.resolveCurrentPhase(task, workflow);
    const taskRoot = this.getAbsoluteTaskRoot(task);

    return withWriteLock(taskRoot, async () => ({
      taskId: task.id,
      phaseId,
      evidenceFiles: await this.writeEvidence(task, phaseId, '_manual'),
    }));
  }

  async createSnapshot(taskId: string): Promise<SnapshotResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);

    const workflow = await this.workflowLoader.load(task.workflowType);
    const { phaseId, definition } = this.phaseResolver.resolveCurrentPhase(task, workflow);
    const promptSnapshot = await this.renderResolvedPhase(task, workflow, phaseId, definition);
    const taskRoot = this.getAbsoluteTaskRoot(task);

    return withWriteLock(taskRoot, async () => ({
      taskId: task.id,
      phaseId,
      snapshotFiles: await this.writeSnapshots(task, phaseId, promptSnapshot, 'manual'),
    }));
  }

  private assertRequiredVariables(
    workflowId: string,
    phaseId: string,
    definition: PhaseDefinition,
    variables: Record<string, string>
  ): void {
    const requiredVariables = definition.requiredVariables ?? [];
    const missingVariables = requiredVariables.filter((name) => {
      const value = variables[name];
      return value === undefined || value === '';
    });

    if (missingVariables.length > 0) {
      throw new MissingRequiredVariablesError(
        workflowId,
        phaseId,
        missingVariables
      );
    }
  }

  private async renderResolvedPhase(
    task: TaskRecord,
    workflow: WorkflowDefinition,
    phaseId: string,
    definition: PhaseDefinition
  ): Promise<string> {
    const variables = this.variableResolver.resolve(task, phaseId);
    this.assertRequiredVariables(workflow.id, phaseId, definition, variables);
    return this.templateRenderer.render(definition.template, variables);
  }

  private resolveNextPhaseId(
    task: TaskRecord,
    workflow: WorkflowDefinition,
    currentPhaseId: string
  ): string | null {
    try {
      const { phaseId } = this.phaseResolver.resolveNextPhase(
        { ...task, currentPhase: currentPhaseId },
        workflow
      );
      return phaseId;
    } catch (error) {
      if (error instanceof PhaseNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  private resolveValidationTemplate(definition: PhaseDefinition): string | undefined {
    const templatePath = definition.completion?.validationTemplate;
    if (!templatePath) {
      return undefined;
    }
    return path.join('.playspec', 'templates', templatePath);
  }

  private buildRollbackSafePoint(
    phaseId: string,
    createdAt: string,
    gitHead: string | null,
    snapshotFiles: string[]
  ): RollbackSafePoint {
    return {
      id: `phase${phaseId}_${createdAt.replace(/[:.]/g, '-')}`,
      createdAt,
      phase: phaseId,
      gitHead,
      taskSnapshotFile: snapshotFiles[0],
      promptSnapshotFile: snapshotFiles[1],
    };
  }

  private getAbsoluteTaskRoot(task: TaskRecord): string {
    return path.join(this.workspaceRoot, task.paths.taskRoot);
  }

  private assertTaskIsActive(task: TaskRecord): void {
    if (task.status !== 'active') {
      throw new TaskNotActiveError(task.id, task.status);
    }
  }

  private async writeSnapshots(
    task: TaskRecord,
    phaseId: string,
    prompt: string,
    mode: 'completion' | 'manual'
  ): Promise<string[]> {
    const taskSnapshotFile =
      mode === 'completion'
        ? `snapshots/phase${phaseId}_before_complete.yaml`
        : `snapshots/phase${phaseId}_manual_task.yaml`;

    await writeTextFileAtomic(
      path.join(this.getAbsoluteTaskRoot(task), taskSnapshotFile),
      stringifyYaml(task)
    );

    if (mode === 'manual') {
      return [taskSnapshotFile];
    }

    const promptSnapshotFile = `snapshots/phase${phaseId}_prompt.md`;
    await writeTextFileAtomic(
      path.join(this.getAbsoluteTaskRoot(task), promptSnapshotFile),
      prompt
    );

    return [taskSnapshotFile, promptSnapshotFile];
  }

  private async writeEvidence(
    task: TaskRecord,
    phaseId: string,
    suffix: string
  ): Promise<string[]> {
    try {
      const [workspaceState, diffStatOutput] = await Promise.all([
        this.gitState.getWorkspaceState(),
        this.gitState.getDiffStat(),
      ]);

      const evidenceFiles = [
        `evidence/phase${phaseId}${suffix}_git_status.txt`,
        `evidence/phase${phaseId}${suffix}_git_diff_stat.txt`,
        `evidence/phase${phaseId}${suffix}_changed_files.txt`,
      ];

      await writeTextFileAtomic(
        path.join(this.getAbsoluteTaskRoot(task), evidenceFiles[0]),
        workspaceState.branchStatus
      );
      await writeTextFileAtomic(
        path.join(this.getAbsoluteTaskRoot(task), evidenceFiles[1]),
        diffStatOutput
      );
      await writeTextFileAtomic(
        path.join(this.getAbsoluteTaskRoot(task), evidenceFiles[2]),
        statusEntryPathList(workspaceState.entries)
      );

      return evidenceFiles;
    } catch (error) {
      if (error instanceof Error) {
        throw new GitEvidenceCollectionError(error.message);
      }
      throw error;
    }
  }

  private async writeReview(
    task: TaskRecord,
    phaseId: string,
    validationTemplate?: string
  ): Promise<string> {
    const reviewFile = `reviews/phase${phaseId}_review.yaml`;
    const reviewRecord = {
      phase: phaseId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      validationTemplate,
    };

    await writeTextFileAtomic(
      path.join(this.getAbsoluteTaskRoot(task), reviewFile),
      stringifyYaml(reviewRecord)
    );

    return reviewFile;
  }

}
