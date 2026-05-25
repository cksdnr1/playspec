import path from 'node:path';
import { access } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { stringify as stringifyYaml } from 'yaml';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { VariableResolver } from '#template/variable-resolver.js';
import { TemplateRenderer } from '#template/template-renderer.js';
import type { TaskStore } from '#storage/task-store.js';
import { CompletionLedgerStore } from '#storage/completion-ledger-store.js';
import {
  TaskNotActiveError,
  GitEvidenceCollectionError,
  PhaseNotFoundError,
  MissingContextRefError,
  MissingResultError,
  InvalidResultError,
  MissingResultMappingError,
  InvalidRoutingTargetError,
  LoopGuardError,
  UnexpectedResultError,
  InvalidCurrentPhaseError,
  AbsoluteContextPathError,
  ContextPathEscapesWorkspaceError,
  ContextFileNotFoundError,
  InvalidRecoveryTargetError,
  HarnessBlockedError,
  InvalidTaskLinkTypeError,
  SelfTaskLinkError,
} from '#core/errors.js';
import { HarnessRecordSchema } from '#core/schemas.js';
import { GitState, statusEntryPathList } from '#core/git-state.js';
import { StateDesyncDetector } from '#core/state-desync-detector.js';
import { RollbackManager } from '#core/rollback-manager.js';
import { EvolutionContextReader } from '#evolution/context-reader.js';
import { FeedbackThreadUpdater } from '#evolution/feedback-thread-updater.js';
import {
  ValidationFeedbackExtractionError,
  ValidationFeedbackExtractor,
} from '#evolution/validation-feedback-extractor.js';
import { DEFAULT_PROMPT_CONTEXT_MODE, writePromptArtifactMetadata } from '#core/prompt-metadata.js';
import { assertRequiredVariables } from '#core/required-variables.js';
import type {
  PhaseDefinition,
  TaskRecord,
  TaskContextRef,
  WorkflowDefinition,
  ResolvedWorkflow,
  CompletionResult,
  CompletionFeedbackFailureStage,
  CompletionFeedbackResult,
  EvidenceResult,
  SnapshotResult,
  DesyncCheckResult,
  RollbackPlanResult,
  RollbackExecutionResult,
  RollbackSafePoint,
  CompletionEvent,
  SetCurrentPhaseResult,
  PromptRenderOptions,
  PromptContextMode,
  CompletePhaseOptions,
  HarnessAttemptResult,
  HarnessRecord,
  TaskLinkType,
  TaskLinkMutationResult,
  PhaseFeedbackFailurePolicy,
} from '#core/types.js';
import { getHarnessRecordPath } from '#utils/paths.js';
import { readTextFile, withWriteLock, writeTextFileAtomic } from '#utils/fs.js';

const DEFAULT_HARNESS_RETRY_BUDGET = 3;
const CONTEXT_SUMMARY_MAX_LENGTH = 240;

export class PlaySpecCore {
  private readonly workflowLoader: WorkflowLoader;
  private readonly phaseResolver: PhaseResolver;
  private readonly variableResolver: VariableResolver;
  private readonly templateRenderer: TemplateRenderer;
  private readonly gitState: GitState;
  private readonly stateDesyncDetector: StateDesyncDetector;
  private readonly rollbackManager: RollbackManager;
  private readonly evolutionContextReader: EvolutionContextReader;
  private readonly completionLedgerStore: CompletionLedgerStore;
  private readonly validationFeedbackExtractor: ValidationFeedbackExtractor;
  private readonly feedbackThreadUpdater: FeedbackThreadUpdater;

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
    this.evolutionContextReader = new EvolutionContextReader(workspaceRoot);
    this.completionLedgerStore = new CompletionLedgerStore(workspaceRoot);
    this.validationFeedbackExtractor = new ValidationFeedbackExtractor(workspaceRoot);
    this.feedbackThreadUpdater = new FeedbackThreadUpdater(workspaceRoot);
  }

  async renderNextPrompt(taskId: string, options: PromptRenderOptions = {}): Promise<string> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    await this.assertContextRefsExist(task);
    const workflow = await this.workflowLoader.resolve(task.workflow);
    this.validateCurrentPhase(task, workflow.definition);
    const { phaseId, definition } = this.phaseResolver.resolveCurrentPhase(task, workflow.definition);
    return this.renderResolvedPhase(task, workflow, phaseId, definition, options);
  }

  async addContextRef(taskId: string, contextPath: string): Promise<boolean> {
    if (path.isAbsolute(contextPath)) {
      throw new AbsoluteContextPathError(contextPath);
    }
    const normalizedPath = path.normalize(contextPath);
    const workspaceRoot = path.resolve(this.workspaceRoot);
    const resolved = path.resolve(workspaceRoot, normalizedPath);
    if (!this.isWithinWorkspace(resolved, workspaceRoot)) {
      throw new ContextPathEscapesWorkspaceError(contextPath);
    }
    try {
      await access(resolved);
    } catch {
      throw new ContextFileNotFoundError(contextPath);
    }

    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    const existing = task.contextRefs ?? [];
    if (existing.some((ref) => path.normalize(ref.path) === normalizedPath)) {
      return false;
    }

    const newRef: TaskContextRef = {
      path: normalizedPath,
      role: 'planning-context',
      source: 'manual',
    };
    await this.taskStore.updateTask(taskId, { contextRefs: [...existing, newRef] });
    return true;
  }

  async addTaskLink(
    sourceTaskId: string,
    targetTaskId: string,
    type: TaskLinkType
  ): Promise<TaskLinkMutationResult> {
    this.assertValidTaskLinkType(type);
    if (sourceTaskId === targetTaskId) {
      throw new SelfTaskLinkError(sourceTaskId);
    }

    const source = await this.taskStore.getTask(sourceTaskId);
    this.assertTaskIsActive(source);
    await this.taskStore.getTask(targetTaskId);

    const links = source.links ?? [];
    const exists = links.some((link) => link.type === type && link.targetTaskId === targetTaskId);
    if (exists) {
      return {
        sourceTaskId,
        targetTaskId,
        type,
        changed: false,
        warning: `Link already exists: ${sourceTaskId} --${type}--> ${targetTaskId}`,
      };
    }

    await this.taskStore.updateTask(sourceTaskId, {
      links: [
        ...links,
        {
          type,
          targetTaskId,
          createdAt: new Date().toISOString(),
          createdBy: 'cli',
        },
      ],
    });

    return { sourceTaskId, targetTaskId, type, changed: true };
  }

  async removeTaskLink(
    sourceTaskId: string,
    targetTaskId: string,
    type?: TaskLinkType
  ): Promise<TaskLinkMutationResult> {
    if (type !== undefined) {
      this.assertValidTaskLinkType(type);
    }
    if (sourceTaskId === targetTaskId) {
      throw new SelfTaskLinkError(sourceTaskId);
    }

    const source = await this.taskStore.getTask(sourceTaskId);
    this.assertTaskIsActive(source);
    await this.taskStore.getTask(targetTaskId);

    const links = source.links ?? [];
    const retained = links.filter((link) => {
      if (link.targetTaskId !== targetTaskId) return true;
      return type !== undefined && link.type !== type;
    });

    if (retained.length === links.length) {
      return {
        sourceTaskId,
        targetTaskId,
        type,
        changed: false,
        warning: type
          ? `No ${type} link exists from ${sourceTaskId} to ${targetTaskId}`
          : `No links exist from ${sourceTaskId} to ${targetTaskId}`,
      };
    }

    await this.taskStore.updateTask(sourceTaskId, {
      links: retained.length > 0 ? retained : undefined,
    });

    return { sourceTaskId, targetTaskId, type, changed: true };
  }

  async renderExplicitPhasePrompt(
    taskId: string,
    phaseId: string,
    options: PromptRenderOptions = {}
  ): Promise<string> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    await this.assertContextRefsExist(task);
    const workflow = await this.workflowLoader.resolve(task.workflow);
    const { definition } = this.phaseResolver.resolveExplicitPhase(phaseId, workflow.definition);
    return this.renderResolvedPhase(task, workflow, phaseId, definition, options);
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
    options: CompletePhaseOptions = {}
  ): Promise<CompletionResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);

    const workflow = await this.workflowLoader.resolve(task.workflow);
    const { phaseId, definition } = this.phaseResolver.resolveCurrentPhase(task, workflow.definition);
    const taskRoot = this.getAbsoluteTaskRoot(task);
    const validationTemplate = this.resolveValidationTemplate(workflow, definition);

    // Phase 3.7: validate routing and compute visit count before any artifact writes
    const { nextPhase, result, visitCount } = this.resolveRoutedCompletion(
      task,
      workflow.definition,
      phaseId,
      definition,
      options.result
    );
    this.assertNextPhaseRequiredVariables(task, workflow, nextPhase);
    const completionArtifactSuffix = this.resolveCompletionArtifactSuffix(visitCount);

    // Render prompt snapshot only after routing validation passes
    const contextMode = options.contextMode ?? DEFAULT_PROMPT_CONTEXT_MODE;
    const promptSnapshot = await this.renderResolvedPhase(task, workflow, phaseId, definition, {
      contextMode,
    });

    return withWriteLock(taskRoot, async () => {
      const snapshotFiles = await this.writeSnapshots(
        task,
        phaseId,
        promptSnapshot,
        'completion',
        contextMode,
        completionArtifactSuffix
      );
      const evidenceFiles = await this.writeEvidence(task, phaseId, completionArtifactSuffix);
      const reviewFile = options.withReview
        ? await this.writeReview(task, phaseId, validationTemplate)
        : undefined;
      const feedback = await this.captureValidationFeedback({
        task,
        workflow,
        definition,
        phaseId,
        result,
        reviewFile,
        snapshotFiles,
      });

      const completedAt = new Date().toISOString();
      const currentGitHead = await this.gitState.getCurrentHead();
      const rollbackSafePoint = this.buildRollbackSafePoint(
        phaseId,
        completedAt,
        currentGitHead,
        snapshotFiles
      );
      const statusAfterCompletion = nextPhase === null ? 'completed' : 'active';
      const completionEvent = await this.writeCompletionEvent({
        task,
        definition,
        phaseId,
        completedAt,
        result,
        nextPhase,
        statusAfterCompletion,
        currentGitHead,
        evidenceFiles,
        snapshotFiles,
        reviewFile,
        feedback,
        rollbackSafePoint,
      });
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
          result,
          visitCount,
        }
      );

      const evolutionContextSnapshotFile = options.withEvolutionContext
        ? await this.evolutionContextReader.writeSnapshot(task, phaseId, 'complete')
        : undefined;

      return {
        taskId: updatedTask.id,
        completedPhase: phaseId,
        nextPhase: updatedTask.currentPhase,
        status: updatedTask.status,
        evidenceFiles,
        snapshotFiles,
        reviewFile,
        evolutionContextSnapshotFile,
        completionEvent,
        ...(feedback !== undefined ? { feedback } : {}),
      };
    });
  }

  async listCompletionEvents(taskId: string): Promise<CompletionEvent[]> {
    await this.taskStore.getTask(taskId);
    return this.completionLedgerStore.listEvents(taskId);
  }

  async readCompletionMarkdown(taskId: string, completionId: string): Promise<string> {
    await this.taskStore.getTask(taskId);
    return (await this.completionLedgerStore.readMarkdown(taskId, completionId)).markdown;
  }

  private resolveRoutedCompletion(
    task: TaskRecord,
    workflow: WorkflowDefinition,
    phaseId: string,
    definition: PhaseDefinition,
    inputResult: string | undefined
  ): { nextPhase: string | null; result: string | undefined; visitCount: number | undefined } {
    const results = definition.gate?.results ?? definition.results;
    const nextByResult = definition.gate?.nextByResult ?? definition.nextByResult;
    const { maxVisits } = definition;

    if (!results || results.length === 0) {
      // Non-routed phase: reject unexpected result to prevent stale state
      if (inputResult !== undefined) {
        throw new UnexpectedResultError(phaseId);
      }
      return {
        nextPhase: this.resolveNextPhaseId(task, workflow, phaseId),
        result: undefined,
        visitCount: undefined,
      };
    }

    // Routed phase: result is required
    if (inputResult === undefined) {
      throw new MissingResultError(phaseId, results);
    }

    // Validate result is in allowed list
    if (!results.includes(inputResult)) {
      throw new InvalidResultError(phaseId, inputResult, results);
    }

    // Validate mapping exists
    if (!nextByResult || !(inputResult in nextByResult)) {
      throw new MissingResultMappingError(phaseId, inputResult);
    }

    const targetPhaseId = nextByResult[inputResult];

    // Validate the mapped target phase exists in the workflow
    if (!workflow.phases[targetPhaseId]) {
      throw new InvalidRoutingTargetError(phaseId, inputResult, targetPhaseId, workflow.id);
    }

    // Calculate visit count from prior completed entries for this phase
    const priorCompleted = task.phaseHistory.filter(
      (e) => e.phase === phaseId && e.status === 'completed'
    );
    const nextVisitCount = priorCompleted.length + 1;

    // Enforce maxVisits before any mutation
    if (maxVisits !== undefined && nextVisitCount > maxVisits) {
      throw new LoopGuardError(phaseId, maxVisits, nextVisitCount);
    }

    return {
      nextPhase: targetPhaseId,
      result: inputResult,
      visitCount: nextVisitCount,
    };
  }

  async setCurrentPhase(
    taskId: string,
    targetPhaseId: string
  ): Promise<SetCurrentPhaseResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);

    const workflow = await this.workflowLoader.load(task.workflow);
    if (!workflow.phaseOrder.includes(targetPhaseId) || !workflow.phases[targetPhaseId]) {
      throw new InvalidRecoveryTargetError(targetPhaseId, workflow.id, workflow.phaseOrder);
    }

    const previousPhase = task.currentPhase;
    await this.taskStore.updateTask(taskId, { currentPhase: targetPhaseId });

    return { taskId, previousPhase, currentPhase: targetPhaseId };
  }

  async closeTask(taskId: string): Promise<TaskRecord> {
    return this.taskStore.archiveCompletedTask(taskId);
  }

  async getHarnessStatus(taskId: string, phaseId?: string): Promise<HarnessRecord> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    const resolvedPhaseId = await this.resolveHarnessPhaseId(task, phaseId);
    const record = await this.readHarnessRecord(task, resolvedPhaseId);
    if (record.phaseId === resolvedPhaseId) {
      return record;
    }
    return this.createDefaultHarnessRecord(task.id, resolvedPhaseId, record.resetEvents);
  }

  async recordHarnessAttempt(
    taskId: string,
    phaseId: string,
    result: HarnessAttemptResult,
    reason?: string
  ): Promise<HarnessRecord> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    const resolvedPhaseId = await this.resolveHarnessPhaseId(task, phaseId);
    const taskRoot = this.getAbsoluteTaskRoot(task);

    return withWriteLock(taskRoot, async () => {
      const existing = await this.readHarnessRecord(task, resolvedPhaseId);
      if (existing.blocked || existing.circuitBreaker) {
        throw new HarnessBlockedError(task.id, resolvedPhaseId);
      }

      const now = new Date().toISOString();
      const attemptCount = result === 'failure'
        ? existing.attemptCount + 1
        : existing.attemptCount;
      const shouldBlock = result === 'failure' && attemptCount >= existing.retryBudget;
      const updated: HarnessRecord = {
        ...existing,
        taskId: task.id,
        phaseId: resolvedPhaseId,
        attemptCount,
        lastResult: result,
        lastFailureReason: result === 'failure' ? (reason ?? null) : null,
        blocked: result === 'success' ? false : shouldBlock,
        circuitBreaker: result === 'success' ? false : shouldBlock,
        updatedAt: now,
      };

      return this.writeHarnessRecord(task, updated);
    });
  }

  async resetHarness(taskId: string, reason?: string): Promise<HarnessRecord> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    const taskRoot = this.getAbsoluteTaskRoot(task);

    return withWriteLock(taskRoot, async () => {
      const resolvedPhaseId = await this.resolveHarnessPhaseId(task);
      const existing = await this.readHarnessRecord(task, resolvedPhaseId);
      const now = new Date().toISOString();
      const updated: HarnessRecord = {
        ...existing,
        taskId: task.id,
        blocked: false,
        circuitBreaker: false,
        updatedAt: now,
        resetEvents: [
          ...existing.resetEvents,
          {
            timestamp: now,
            taskId: task.id,
            previousBlocked: existing.blocked,
            previousCircuitBreaker: existing.circuitBreaker,
            ...(reason !== undefined && reason !== '' ? { reason } : {}),
            source: 'cli',
          },
        ],
      };

      return this.writeHarnessRecord(task, updated);
    });
  }

  async collectEvidence(taskId: string): Promise<EvidenceResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);

    const workflow = await this.workflowLoader.load(task.workflow);
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

    const workflow = await this.workflowLoader.resolve(task.workflow);
    const { phaseId, definition } = this.phaseResolver.resolveCurrentPhase(task, workflow.definition);
    const promptSnapshot = await this.renderResolvedPhase(task, workflow, phaseId, definition);
    const taskRoot = this.getAbsoluteTaskRoot(task);

    return withWriteLock(taskRoot, async () => ({
      taskId: task.id,
      phaseId,
      snapshotFiles: await this.writeSnapshots(task, phaseId, promptSnapshot, 'manual'),
    }));
  }

  private async renderResolvedPhase(
    task: TaskRecord,
    workflow: ResolvedWorkflow,
    phaseId: string,
    definition: PhaseDefinition,
    options: PromptRenderOptions = {}
  ): Promise<string> {
    const contextMode = options.contextMode ?? DEFAULT_PROMPT_CONTEXT_MODE;
    const variables = this.resolveAndAssertRequiredVariables(task, workflow, phaseId, definition);
    const basePrompt = this.appendLinkedTaskContext(
      await this.templateRenderer.render(definition.template, variables, workflow.templateDir),
      task
    );
    const prompt = await this.appendContextModeSection(basePrompt, task, contextMode);
    if (!options.withEvolutionContext) {
      return prompt;
    }
    const context = await this.evolutionContextReader.collect(task);
    return `${prompt.trimEnd()}\n\n${this.evolutionContextReader.formatPromptSection(context)}\n`;
  }

  private assertNextPhaseRequiredVariables(
    task: TaskRecord,
    workflow: ResolvedWorkflow,
    nextPhase: string | null
  ): void {
    if (nextPhase === null) {
      return;
    }

    const nextDefinition = workflow.definition.phases[nextPhase];
    if (!nextDefinition) {
      throw new PhaseNotFoundError(nextPhase, workflow.id);
    }

    this.resolveAndAssertRequiredVariables(task, workflow, nextPhase, nextDefinition);
  }

  private resolveAndAssertRequiredVariables(
    task: TaskRecord,
    workflow: ResolvedWorkflow,
    phaseId: string,
    definition: PhaseDefinition
  ): Record<string, string> {
    const variables = this.variableResolver.resolve(task, phaseId, workflow.definition, definition);
    assertRequiredVariables(workflow.id, phaseId, definition, workflow.definition.variables, variables);
    return variables;
  }

  private async appendContextModeSection(
    prompt: string,
    task: TaskRecord,
    contextMode: PromptContextMode
  ): Promise<string> {
    const refs = task.contextRefs ?? [];
    if (refs.length === 0) {
      return prompt;
    }

    if (contextMode === 'compact') {
      const summaries = await Promise.all(
        refs.map(async (ref) => {
          const content = await readTextFile(path.resolve(this.workspaceRoot, ref.path));
          const summary = summarizeContextContent(content);
          return `- \`${ref.path}\` (role: ${ref.role}, source: ${ref.source})${summary ? `: ${summary}` : ''}`;
        })
      );
      return `${prompt.trimEnd()}\n\n## Compact Context Summary\n\n${summaries.join('\n')}\n`;
    }

    const sections = await Promise.all(
      refs.map(async (ref) => {
        const content = await readTextFile(path.resolve(this.workspaceRoot, ref.path));
        return [
          `### ${ref.path}`,
          '',
          `role: ${ref.role}`,
          `source: ${ref.source}`,
          '',
          '```',
          content.trimEnd(),
          '```',
        ].join('\n');
      })
    );
    return `${prompt.trimEnd()}\n\n## Context Files\n\n${sections.join('\n\n')}\n`;
  }

  private appendLinkedTaskContext(prompt: string, task: TaskRecord): string {
    const links = task.links ?? [];
    if (links.length === 0) {
      return prompt;
    }

    const sections: string[] = ['Linked task context:'];
    const sectionMap: Array<[TaskLinkType, string]> = [
      ['parent', 'Parents'],
      ['after', 'After'],
      ['related', 'Related'],
    ];
    for (const [type, title] of sectionMap) {
      const targets = links
        .filter((link) => link.type === type)
        .map((link) => link.targetTaskId);
      if (targets.length === 0) continue;
      sections.push(`${title}:`);
      sections.push(...targets.map((target) => `- ${target}`));
    }

    return `${prompt.trimEnd()}\n\n${sections.join('\n')}\n`;
  }

  private assertValidTaskLinkType(type: string): asserts type is TaskLinkType {
    if (type !== 'parent' && type !== 'after' && type !== 'related') {
      throw new InvalidTaskLinkTypeError(type);
    }
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

  private resolveValidationTemplate(workflow: ResolvedWorkflow, definition: PhaseDefinition): string | undefined {
    const templatePath = definition.completion?.validationTemplate;
    if (!templatePath) {
      return undefined;
    }
    return path.join('workflow', workflow.id, 'templates', templatePath);
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

  private resolveCompletionArtifactSuffix(visitCount: number | undefined): string {
    if (visitCount === undefined || visitCount === 1) {
      return '';
    }
    return `_visit${visitCount}`;
  }

  private async captureValidationFeedback(input: {
    task: TaskRecord;
    workflow: ResolvedWorkflow;
    definition: PhaseDefinition;
    phaseId: string;
    result: string | undefined;
    reviewFile?: string;
    snapshotFiles: string[];
  }): Promise<CompletionFeedbackResult | undefined> {
    const feedbackConfig = input.definition.feedback;
    if (!feedbackConfig?.enabled) {
      return undefined;
    }

    try {
      const artifact = this.resolveFeedbackArtifact(feedbackConfig.scoreSource.artifactRole, {
        reviewFile: input.reviewFile,
        snapshotFiles: input.snapshotFiles,
      });
      if (!artifact) {
        return this.handleFeedbackCaptureFailure(
          feedbackConfig.onFailure,
          'missing_artifact',
          `Feedback is enabled for phase "${input.phaseId}", but no ${feedbackConfig.scoreSource.artifactRole} artifact was produced.`
        );
      }

      let artifactContent: string;
      try {
        artifactContent = await readTextFile(path.join(this.getAbsoluteTaskRoot(input.task), artifact));
      } catch (error) {
        return this.handleFeedbackCaptureFailure(
          feedbackConfig.onFailure,
          'missing_artifact',
          `Could not read feedback artifact "${artifact}": ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const extraction = this.validationFeedbackExtractor.extract({
        task: input.task,
        workflow: input.workflow,
        feedbackConfig,
        phaseId: input.phaseId,
        artifactContent,
        artifactPath: path.join(input.task.paths.taskRoot, artifact),
        completionResult: this.normalizeFeedbackApprovalResult(input.result),
      });

      try {
        const update = await this.feedbackThreadUpdater.update({
          task: input.task,
          workflow: input.workflow,
          feedbackConfig,
          phaseId: input.phaseId,
          approvalResult: extraction.approval.result,
          feedbackResult: extraction.feedback.result,
          causeClassification: extraction.causeClassification,
          summary: extraction.summary,
          ...(extraction.score !== undefined ? { score: extraction.score } : {}),
          ...(extraction.rawObservationRef !== undefined ? { rawObservationRef: extraction.rawObservationRef } : {}),
          ...(extraction.dedupeFieldValues !== undefined ? { dedupeFieldValues: extraction.dedupeFieldValues } : {}),
        });

        return {
          status: 'captured',
          threadId: update.thread.id,
          threadPath: this.toWorkspaceRelativePath(update.threadPath),
          created: update.created,
          approvalResult: extraction.approval.result,
          feedbackResult: extraction.feedback.result,
          dedupeKeyHash: update.thread.dedupeKeyHash,
          ...(extraction.score !== undefined ? { score: extraction.score } : {}),
        };
      } catch (error) {
        return this.handleFeedbackCaptureFailure(
          feedbackConfig.onFailure,
          'thread_update',
          error instanceof Error ? error.message : String(error)
        );
      }
    } catch (error) {
      if (error instanceof ValidationFeedbackExtractionError) {
        return this.handleFeedbackCaptureFailure(feedbackConfig.onFailure, 'extraction', error.message);
      }
      throw error;
    }
  }

  private resolveFeedbackArtifact(
    artifactRole: string,
    artifacts: { reviewFile?: string; snapshotFiles: string[] }
  ): string | undefined {
    const normalizedRole = artifactRole.toLowerCase().replace(/[\s-]+/g, '_');
    if (normalizedRole.includes('review')) {
      return artifacts.reviewFile;
    }
    if (normalizedRole.includes('prompt') || normalizedRole.includes('snapshot')) {
      return artifacts.snapshotFiles.find((file) => file.endsWith('_prompt.md'));
    }
    if (normalizedRole === 'completion_markdown') {
      return undefined;
    }

    const byBasename = [...artifacts.snapshotFiles, ...(artifacts.reviewFile ? [artifacts.reviewFile] : [])].find(
      (file) => path.basename(file, path.extname(file)) === artifactRole
    );
    return byBasename;
  }

  private handleFeedbackCaptureFailure(
    policy: PhaseFeedbackFailurePolicy,
    stage: CompletionFeedbackFailureStage,
    message: string
  ): CompletionFeedbackResult {
    if (policy === 'fail_completion') {
      throw new ValidationFeedbackExtractionError(message);
    }
    return {
      status: 'failed',
      policy,
      stage,
      message,
      feedbackResult: 'parse_failed',
    };
  }

  private normalizeFeedbackApprovalResult(result: string | undefined) {
    if (
      result === 'approved' ||
      result === 'needs_revision' ||
      result === 'failed' ||
      result === 'skipped'
    ) {
      return result;
    }
    return undefined;
  }

  private toWorkspaceRelativePath(filePath: string): string {
    if (!path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.relative(this.workspaceRoot, filePath);
  }

  private async writeCompletionEvent(input: {
    task: TaskRecord;
    definition: PhaseDefinition;
    phaseId: string;
    completedAt: string;
    result: string | undefined;
    nextPhase: string | null;
    statusAfterCompletion: 'active' | 'completed';
    currentGitHead: string | null;
    evidenceFiles: string[];
    snapshotFiles: string[];
    reviewFile?: string;
    feedback?: CompletionFeedbackResult;
    rollbackSafePoint: RollbackSafePoint;
  }): Promise<CompletionEvent> {
    const existing = await this.completionLedgerStore.listEvents(input.task.id);
    const sequence = existing.length + 1;
    const id = String(sequence).padStart(4, '0');
    const eventType = this.resolveCompletionEventType(input.definition, input.phaseId, input.result);
    const markdownFile = path.join(
      'completions',
      `${id}-${safeFilePart(input.phaseId)}${input.result ? `-${safeFilePart(eventType)}` : ''}.md`
    );
    const event: CompletionEvent = {
      id,
      sequence,
      taskId: input.task.id,
      phase: input.phaseId,
      phaseTitle: input.definition.title,
      completedAt: input.completedAt,
      type: eventType,
      previousPhase: input.phaseId,
      nextPhase: input.nextPhase,
      statusAfterCompletion: input.statusAfterCompletion,
      gitHead: input.currentGitHead,
      evidenceFiles: input.evidenceFiles,
      snapshotFiles: input.snapshotFiles,
      rollbackSafePointId: input.rollbackSafePoint.id,
      markdownFile,
      ...(input.result !== undefined ? { result: input.result } : {}),
      ...(input.reviewFile !== undefined ? { reviewFile: input.reviewFile } : {}),
      ...(input.feedback !== undefined ? { feedback: input.feedback } : {}),
    };
    const markdown = this.renderCompletionMarkdown(input.task, event);
    return this.completionLedgerStore.appendEvent(input.task, event, markdown);
  }

  private resolveCompletionEventType(
    definition: PhaseDefinition,
    phaseId: string,
    result: string | undefined
  ): string {
    if (result !== undefined && definition.gate?.eventTypes?.[result]) {
      return definition.gate.eventTypes[result];
    }
    if (result !== undefined && definition.eventTypes?.[result]) {
      return definition.eventTypes[result];
    }
    if (definition.completion?.eventType) {
      return definition.completion.eventType;
    }
    if (result !== undefined) {
      return result;
    }
    if (phaseId.includes('patch')) {
      return 'patch_completed';
    }
    if (phaseId.includes('draft')) {
      return 'draft_completed';
    }
    if (phaseId.includes('plan_create') || phaseId.includes('implementation_plan_create')) {
      return 'plan_created';
    }
    if (phaseId.includes('implementation')) {
      return 'implementation_completed';
    }
    if (phaseId.includes('test')) {
      return 'tests_completed';
    }
    if (phaseId.includes('refactor')) {
      return 'refactor_completed';
    }
    if (phaseId.includes('pr')) {
      return 'pr_prepared';
    }
    return 'phase_completed';
  }

  private renderCompletionMarkdown(task: TaskRecord, event: CompletionEvent): string {
    const displayPath = (taskRootRelativePath: string) =>
      path.join(task.paths.taskRoot, taskRootRelativePath);
    const evidence = event.evidenceFiles.map((file) => `- ${displayPath(file)}`).join('\n') || '- none';
    const snapshots = event.snapshotFiles.map((file) => `- ${displayPath(file)}`).join('\n') || '- none';
    const review = event.reviewFile ? `- ${displayPath(event.reviewFile)}` : '- none';
    const feedback = event.feedback ? `\n## Feedback\n\n${this.renderCompletionFeedback(event.feedback)}\n` : '';
    return `# Completion ${event.id}: ${event.phase}

- Task: ${event.taskId}
- Phase: ${event.phase}
- Title: ${event.phaseTitle}
- Completed at: ${event.completedAt}
- Type: ${event.type}
- Result: ${event.result ?? 'none'}
- Previous phase: ${event.previousPhase ?? 'none'}
- Next phase: ${event.nextPhase ?? 'none'}
- Status after completion: ${event.statusAfterCompletion}
- Git HEAD: ${event.gitHead ?? 'null'}
- Rollback safe point: ${event.rollbackSafePointId ?? 'none'}

## Evidence

${evidence}

## Snapshots

${snapshots}

## Review

${review}
${feedback}

## Rollback Notes

Use the rollback safe point above for state rollback context. This markdown is an audit/evidence artifact and should not itself mutate task state.
`;
  }

  private renderCompletionFeedback(feedback: CompletionFeedbackResult): string {
    if (feedback.status === 'captured') {
      return [
        `- Status: captured`,
        `- Thread: ${feedback.threadId}`,
        `- Thread path: ${feedback.threadPath}`,
        `- Created: ${feedback.created}`,
        `- Approval result: ${feedback.approvalResult}`,
        `- Feedback result: ${feedback.feedbackResult}`,
        `- Dedupe key hash: ${feedback.dedupeKeyHash}`,
        ...(feedback.score !== undefined ? [`- Score: ${feedback.score}`] : []),
      ].join('\n');
    }

    return [
      `- Status: failed`,
      `- Policy: ${feedback.policy}`,
      `- Stage: ${feedback.stage}`,
      `- Feedback result: ${feedback.feedbackResult}`,
      `- Message: ${feedback.message}`,
    ].join('\n');
  }

  private getAbsoluteTaskRoot(task: TaskRecord): string {
    return path.join(this.workspaceRoot, task.paths.taskRoot);
  }

  private async resolveHarnessPhaseId(task: TaskRecord, phaseId?: string): Promise<string> {
    const workflow = await this.workflowLoader.load(task.workflow);
    if (phaseId !== undefined) {
      if (!workflow.phaseOrder.includes(phaseId) || !workflow.phases[phaseId]) {
        throw new InvalidRecoveryTargetError(phaseId, task.workflow, workflow.phaseOrder);
      }
      return phaseId;
    }
    const resolved = this.phaseResolver.resolveCurrentPhase(task, workflow);
    return resolved.phaseId;
  }

  private async readHarnessRecord(task: TaskRecord, phaseId: string): Promise<HarnessRecord> {
    const harnessPath = getHarnessRecordPath(this.workspaceRoot, task.id);
    try {
      const content = await readTextFile(harnessPath);
      return HarnessRecordSchema.parse(parseYaml(content) as unknown);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.createDefaultHarnessRecord(task.id, phaseId);
      }
      throw error;
    }
  }

  private createDefaultHarnessRecord(
    taskId: string,
    phaseId: string,
    resetEvents: HarnessRecord['resetEvents'] = []
  ): HarnessRecord {
    return {
      taskId,
      phaseId,
      attemptCount: 0,
      retryBudget: DEFAULT_HARNESS_RETRY_BUDGET,
      lastResult: null,
      lastFailureReason: null,
      blocked: false,
      circuitBreaker: false,
      updatedAt: new Date().toISOString(),
      resetEvents,
    };
  }

  private async writeHarnessRecord(task: TaskRecord, record: HarnessRecord): Promise<HarnessRecord> {
    const validated = HarnessRecordSchema.parse(record);
    await writeTextFileAtomic(
      getHarnessRecordPath(this.workspaceRoot, task.id),
      stringifyYaml(validated)
    );
    return validated;
  }

  private assertTaskIsActive(task: TaskRecord): void {
    if (task.status !== 'active') {
      throw new TaskNotActiveError(task.id, task.status);
    }
  }

  private validateCurrentPhase(task: TaskRecord, workflow: WorkflowDefinition): void {
    if (task.currentPhase === null) return;
    if (!workflow.phaseOrder.includes(task.currentPhase)) {
      throw new InvalidCurrentPhaseError(task.currentPhase, workflow.id, workflow.phaseOrder);
    }
  }

  private async assertContextRefsExist(task: TaskRecord): Promise<void> {
    if (!task.contextRefs || task.contextRefs.length === 0) return;
    const workspaceRoot = path.resolve(this.workspaceRoot);
    for (const ref of task.contextRefs) {
      if (path.isAbsolute(ref.path)) {
        throw new MissingContextRefError(ref.path);
      }
      const resolved = path.resolve(workspaceRoot, ref.path);
      if (!this.isWithinWorkspace(resolved, workspaceRoot)) {
        throw new MissingContextRefError(ref.path);
      }
      try {
        await access(resolved);
      } catch {
        throw new MissingContextRefError(ref.path);
      }
    }
  }

  private isWithinWorkspace(resolvedPath: string, resolvedWorkspaceRoot: string): boolean {
    return resolvedPath === resolvedWorkspaceRoot || resolvedPath.startsWith(resolvedWorkspaceRoot + path.sep);
  }

  private async writeSnapshots(
    task: TaskRecord,
    phaseId: string,
    prompt: string,
    mode: 'completion' | 'manual',
    contextMode: PromptContextMode = DEFAULT_PROMPT_CONTEXT_MODE,
    completionSuffix = ''
  ): Promise<string[]> {
    const taskSnapshotFile =
      mode === 'completion'
        ? `snapshots/phase${phaseId}${completionSuffix}_before_complete.yaml`
        : `snapshots/phase${phaseId}_manual_task.yaml`;

    await writeTextFileAtomic(
      path.join(this.getAbsoluteTaskRoot(task), taskSnapshotFile),
      stringifyYaml(task)
    );

    if (mode === 'manual') {
      return [taskSnapshotFile];
    }

    const promptSnapshotFile = `snapshots/phase${phaseId}${completionSuffix}_prompt.md`;
    const promptSnapshotPath = path.join(this.getAbsoluteTaskRoot(task), promptSnapshotFile);
    await writeTextFileAtomic(promptSnapshotPath, prompt);
    await writePromptArtifactMetadata({
      workspaceRoot: this.workspaceRoot,
      task,
      promptArtifactPath: promptSnapshotPath,
      contextMode,
      generationSource: 'complete',
      phaseId,
    });

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

function summarizeContextContent(content: string): string {
  const firstParagraph = content
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .find((part) => part.length > 0);
  if (!firstParagraph) {
    return '(empty file)';
  }
  if (firstParagraph.length <= CONTEXT_SUMMARY_MAX_LENGTH) {
    return firstParagraph;
  }
  return `${firstParagraph.slice(0, CONTEXT_SUMMARY_MAX_LENGTH - 3)}...`;
}

function safeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'completion';
}
