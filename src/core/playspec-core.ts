import { renderCompletionFeedback } from './completion-feedback-capture.js';
import path from 'node:path';
import { access, stat } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { stringify as stringifyYaml } from 'yaml';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { mergeVariableDeclarations, VariableResolver } from '#template/variable-resolver.js';
import { TemplateRenderer } from '#template/template-renderer.js';
import type { TaskStore } from '#storage/task-store.js';
import { CompletionLedgerStore } from '#storage/completion-ledger-store.js';
import { CompletionTransactionStore } from '#storage/completion-transaction-store.js';
import { randomUUID } from 'node:crypto';
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
  PhaseAdvancedError,
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
import { CompletionFeedbackCapture } from '#core/completion-feedback-capture.js';
import type { CompletionFeedbackCaptureInput } from '#core/completion-feedback-capture.js';
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
  CompletionOperatorGuidance,
  EvidenceResult,
  FinalizedWorkflowArtifact,
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
  CompletePhaseInput,
  TaskStatusSummary,
  HarnessAttemptResult,
  HarnessRecord,
  TaskLinkType,
  TaskLinkMutationResult,
  PhaseFeedbackFailurePolicy,
} from '#core/types.js';
import { getActiveTaskRoot, getHarnessRecordPath } from '#utils/paths.js';
import { readTextFile, withWriteLock, writeTextFileAtomic } from '#utils/fs.js';
import { resolveContainedPath } from '#utils/contained-path.js';
import { withTaskMutationLock } from '#storage/task-mutation-lock.js';
import { validateGateReport } from '#core/validation-gate.js';

const DEFAULT_HARNESS_RETRY_BUDGET = 3;
const CONTEXT_SUMMARY_MAX_LENGTH = 240;
const CONTEXT_BODY_MAX_LINE_LENGTH = 1_000;

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
  private readonly completionTransactionStore: CompletionTransactionStore;
  private readonly feedbackCapture: CompletionFeedbackCapture;

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
    this.completionTransactionStore = new CompletionTransactionStore(workspaceRoot, taskStore);
    this.feedbackCapture = new CompletionFeedbackCapture(workspaceRoot);
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
    return this.withTaskWriteLock(taskId, () => this.addContextRefLocked(taskId, contextPath));
  }

  private async addContextRefLocked(taskId: string, contextPath: string): Promise<boolean> {
    if (path.isAbsolute(contextPath)) {
      throw new AbsoluteContextPathError(contextPath);
    }
    const normalizedPath = path.normalize(contextPath);
    const workspaceRoot = path.resolve(this.workspaceRoot);
    const resolved = path.resolve(workspaceRoot, normalizedPath);
    if (!this.isWithinWorkspace(resolved, workspaceRoot)) {
      throw new ContextPathEscapesWorkspaceError(contextPath);
    }
    try { await resolveContainedPath(workspaceRoot, normalizedPath); }
    catch { throw new ContextPathEscapesWorkspaceError(contextPath); }
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

  async addTaskLink(sourceTaskId: string, targetTaskId: string, type: TaskLinkType): Promise<TaskLinkMutationResult> {
    return this.withTaskWriteLock(sourceTaskId, () => this.addTaskLinkLocked(sourceTaskId, targetTaskId, type));
  }

  private async addTaskLinkLocked(
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

  async removeTaskLink(sourceTaskId: string, targetTaskId: string, type?: TaskLinkType): Promise<TaskLinkMutationResult> {
    return this.withTaskWriteLock(sourceTaskId, () => this.removeTaskLinkLocked(sourceTaskId, targetTaskId, type));
  }

  private async removeTaskLinkLocked(
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
    this.assertTaskIsActive(task);
    return this.stateDesyncDetector.run(task);
  }

  async planRollback(taskId: string): Promise<RollbackPlanResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    return this.rollbackManager.plan(task);
  }

  async rollbackStateOnly(taskId: string): Promise<RollbackExecutionResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    return this.rollbackManager.rollbackStateOnly(task);
  }

  async executeGitRollback(taskId: string): Promise<RollbackExecutionResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);
    return this.rollbackManager.executeGitRollback(task);
  }

  async completePhase(taskId: string, options: CompletePhaseOptions = {}): Promise<CompletionResult> {
    return this.withTaskWriteLock(taskId, async recovered => {
      if (recovered && (options.requestId === undefined || options.requestId === recovered.requestId) &&
          (options.expectedPhaseId === undefined || options.expectedPhaseId === recovered.phase)) {
        if (options.result !== undefined && options.result !== recovered.result) throw new Error('Recovered completion has a different result.');
        return this.replayCompletion(await this.taskStore.getTask(taskId), recovered);
      }
      return this.completePhaseLocked(taskId, options);
    });
  }

  private withTaskWriteLock<T>(taskId: string, action: (recovered?: CompletionEvent) => Promise<T>): Promise<T> {
    return withTaskMutationLock(this.workspaceRoot, this.taskStore, taskId, action);
  }

  private async completePhaseLocked(
    taskId: string,
    options: CompletePhaseOptions = {}
  ): Promise<CompletionResult> {
    const task = await this.taskStore.getTask(taskId);
    if (options.requestId !== undefined) {
      if (!options.requestId || options.requestId.length > 128) throw new Error('requestId must contain 1 to 128 characters.');
      const prior = (await this.completionLedgerStore.listEvents(taskId)).find(event => event.requestId === options.requestId);
      if (prior) {
        if ((options.expectedPhaseId !== undefined && options.expectedPhaseId !== prior.phase) ||
            (options.result !== undefined && options.result !== prior.result)) throw new Error('requestId was already used for a different completion.');
        return this.replayCompletion(task, prior);
      }
    }
    this.assertTaskIsActive(task);

    const workflow = await this.workflowLoader.resolve(task.workflow);
    const { phaseId, definition } = this.phaseResolver.resolveCurrentPhase(task, workflow.definition);

    // Guard against the workflow advancing underneath the caller. If the caller
    // declares the phase it intended to complete and it no longer matches the
    // resolved current phase, reject instead of completing a phase the caller
    // never saw. Runs before any state mutation.
    if (options.expectedPhaseId !== undefined && options.expectedPhaseId !== phaseId) {
      throw new PhaseAdvancedError(options.expectedPhaseId, phaseId);
    }

    const harness = await this.readHarnessRecord(task, phaseId);
    if (harness.blocked || harness.circuitBreaker) throw new HarnessBlockedError(task.id, phaseId);

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
    const requiredPaths = [...(definition.requiredOutputs ?? []),
      ...(nextPhase === null ? Object.values(workflow.definition.artifacts ?? {}).filter(a => a.required).map(a => a.path) : [])];
    const artifactVariables = this.resolveAndAssertRequiredVariables(task, workflow, phaseId, definition,
      requiredPaths.flatMap(extractPlaceholderNames));
    for (const template of requiredPaths) {
      const artifactPath = renderInlineTemplate(template, artifactVariables);
      try {
        const resolved = await resolveContainedPath(this.workspaceRoot, artifactPath);
        const info = await stat(resolved);
        if (!info.isFile() || info.size === 0) throw new Error('Expected a nonempty regular file');
      } catch (cause) {
        throw new Error(`Required output "${artifactPath}" is missing, empty, not a regular file, or outside the workspace: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
    const validation = await validateGateReport({ workspaceRoot: this.workspaceRoot, task, phaseId, definition,
      variables: this.resolveAndAssertRequiredVariables(task, workflow, phaseId, definition), result });
    if (nextPhase === null) {
      await this.resolveFinalizedArtifacts(task, workflow, phaseId, definition);
    }
    const ledgerVisits = (await this.completionLedgerStore.listEvents(taskId)).filter(event => event.phase === phaseId).length + 1;
    let completionArtifactSuffix = this.resolveCompletionArtifactSuffix(ledgerVisits);
    if (await this.anyTaskArtifactExists(task, [
      `snapshots/phase${phaseId}${completionArtifactSuffix}_before_complete.yaml`,
      `snapshots/phase${phaseId}${completionArtifactSuffix}_prompt.md`,
      ...this.buildEvidenceFiles(phaseId, completionArtifactSuffix),
    ])) completionArtifactSuffix += `_attempt_${randomUUID()}`;

    // Render prompt snapshot only after routing validation passes
    const contextMode = options.contextMode ?? DEFAULT_PROMPT_CONTEXT_MODE;
    const promptSnapshot = await this.renderResolvedPhase(task, workflow, phaseId, definition, {
      contextMode,
    });

    {
      const snapshotFiles = await this.writeSnapshots(
        task,
        phaseId,
        promptSnapshot,
        'completion',
        contextMode,
        completionArtifactSuffix
      );
      const evidenceFiles = await this.writeEvidence(task, phaseId, completionArtifactSuffix);
      const validationReportFile = validation ? `reviews/phase${phaseId}${completionArtifactSuffix}_validation.yaml` : undefined;
      if (validationReportFile && validation) {
        await writeTextFileAtomic(path.join(taskRoot, validationReportFile), validation.content);
        evidenceFiles.push(validationReportFile);
      }
      const reviewFile = options.withReview
        ? await this.writeReview(task, phaseId, validationTemplate, completionArtifactSuffix)
        : undefined;
      const feedbackRequest: CompletionFeedbackCaptureInput = {
        validationReportFile,
        task,
        workflow,
        definition,
        phaseId,
        result,
        reviewFile,
        snapshotFiles,
      };
      const feedback = await this.feedbackCapture.capture(feedbackRequest, true);

      const completedAt = new Date().toISOString();
      const currentGitHead = await this.gitState.getCurrentHead();
      const rollbackSafePoint = this.buildRollbackSafePoint(
        phaseId,
        completedAt,
        currentGitHead,
        snapshotFiles
      );
      const statusAfterCompletion = nextPhase === null ? 'completed' : 'active';
      const completionInput: CompletePhaseInput = {
        phaseId, nextPhase, reviewFile, evidenceFiles, snapshotFiles, validationTemplate,
        stateSync: { lastKnownGitHead: currentGitHead, lastCompletedAt: completedAt },
        rollback: { lastSafePoint: rollbackSafePoint }, result, visitCount,
      };
      const completionEvent = await this.writeCompletionEvent({
        validationReportFile,
        feedbackRequest: feedback === undefined && definition.feedback?.enabled ? feedbackRequest : undefined,
        completionInput,
        requestId: options.requestId,
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
      const updatedTask = await this.taskStore.getTask(taskId);

      const evolutionContextSnapshotFile = options.withEvolutionContext
        ? await this.evolutionContextReader.writeSnapshot(task, phaseId, 'complete')
        : undefined;
      const isWorkflowComplete = updatedTask.status === 'completed' && updatedTask.currentPhase === null;
      const finalizedArtifacts = await this.resolveFinalizedArtifacts(updatedTask, workflow, phaseId, definition);
      const operatorGuidance = this.buildCompletionOperatorGuidance(updatedTask, isWorkflowComplete);

      return {
        taskId: updatedTask.id,
        workflow: workflow.id,
        completedPhase: phaseId,
        completedPhaseId: phaseId,
        previousPhaseId: completionEvent.previousPhase,
        nextPhase: updatedTask.currentPhase,
        nextPhaseId: updatedTask.currentPhase,
        status: updatedTask.status,
        taskStatus: updatedTask.status,
        isWorkflowComplete,
        evidenceFiles,
        snapshotFiles,
        finalizedArtifacts,
        completionRecordPath: completionEvent.markdownFile,
        operatorGuidance,
        reviewFile,
        evolutionContextSnapshotFile,
        completionEvent,
        ...(completionEvent.feedback !== undefined ? { feedback: completionEvent.feedback } : {}),
      };
    }
  }

  async listCompletionEvents(taskId: string): Promise<CompletionEvent[]> {
    return this.withTaskWriteLock(taskId, async () => {
      await this.taskStore.getTask(taskId);
      return this.completionLedgerStore.listEvents(taskId);
    });
  }

  async recoverPendingCompletion(taskId: string): Promise<CompletionEvent | undefined> {
    return this.withTaskWriteLock(taskId, async recovered => recovered);
  }

  private async replayCompletion(task: TaskRecord, event: CompletionEvent): Promise<CompletionResult> {
    const projection = { ...task, status: event.statusAfterCompletion, currentPhase: event.nextPhase };
    const workflow = await this.workflowLoader.resolve(task.workflow);
    const definition = workflow.definition.phases[event.phase];
    const isWorkflowComplete = event.statusAfterCompletion === 'completed' && event.nextPhase === null;
    return {
      taskId: task.id, workflow: task.workflow, completedPhase: event.phase, completedPhaseId: event.phase,
      previousPhaseId: event.previousPhase, nextPhase: event.nextPhase, nextPhaseId: event.nextPhase,
      status: event.statusAfterCompletion, taskStatus: event.statusAfterCompletion, isWorkflowComplete,
      evidenceFiles: event.evidenceFiles, snapshotFiles: event.snapshotFiles,
      finalizedArtifacts: definition ? await this.resolveFinalizedArtifacts(projection, workflow, event.phase, definition) : [],
      completionRecordPath: event.markdownFile, operatorGuidance: this.buildCompletionOperatorGuidance(projection, isWorkflowComplete),
      completionEvent: event, reviewFile: event.reviewFile, ...(event.feedback ? { feedback: event.feedback } : {}),
    };
  }

  async readCompletionMarkdown(taskId: string, completionId: string): Promise<string> {
    await this.taskStore.getTask(taskId);
    return (await this.completionLedgerStore.readMarkdown(taskId, completionId)).markdown;
  }

  /**
   * Lightweight "where am I" projection of a task. Returns only the few fields an
   * agent needs to orient (current phase, status, completion), without the full
   * task record's phaseHistory/contextRefs or workspace diagnostics. Use this
   * instead of getTask/listTasks for cheap status polling.
   */
  async getTaskStatus(taskId: string): Promise<TaskStatusSummary> {
    const task = await this.withTaskWriteLock(taskId, () => this.taskStore.getTask(taskId));
    const isWorkflowComplete = task.status === 'completed' && task.currentPhase === null;

    // Report the resolved effective phase. A freshly created active task stores a
    // null currentPhase but effectively sits on the first phase, so resolve it the
    // same way the rest of the engine does.
    let currentPhase: string | null = null;
    if (!isWorkflowComplete && task.status === 'active') {
      const workflow = await this.workflowLoader.resolve(task.workflow);
      currentPhase = this.phaseResolver.resolveCurrentPhase(task, workflow.definition).phaseId;
    } else {
      currentPhase = task.currentPhase;
    }

    return {
      id: task.id,
      title: task.title,
      workflow: task.workflow,
      status: task.status,
      currentPhase,
      isWorkflowComplete,
      lastCompletedAt: task.stateSync?.lastCompletedAt ?? null,
      lastKnownGitHead: task.stateSync?.lastKnownGitHead ?? null,
    };
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

  async setCurrentPhase(taskId: string, targetPhaseId: string): Promise<SetCurrentPhaseResult> {
    return this.withTaskWriteLock(taskId, () => this.setCurrentPhaseLocked(taskId, targetPhaseId));
  }

  private async setCurrentPhaseLocked(
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
    return this.withTaskWriteLock(taskId, () => this.taskStore.archiveCompletedTask(taskId));
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
    return this.withTaskWriteLock(taskId, async () => {
      const task = await this.taskStore.getTask(taskId);
      this.assertTaskIsActive(task);
      const currentPhase = await this.resolveHarnessPhaseId(task);
      if (phaseId !== currentPhase) throw new PhaseAdvancedError(phaseId, currentPhase);
      const resolvedPhaseId = currentPhase;
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
    return this.withTaskWriteLock(taskId, async () => {
      const task = await this.taskStore.getTask(taskId);
      this.assertTaskIsActive(task);
      const resolvedPhaseId = await this.resolveHarnessPhaseId(task);
      const existing = await this.readHarnessRecord(task, resolvedPhaseId);
      const now = new Date().toISOString();
      const updated: HarnessRecord = {
        ...existing,
        taskId: task.id,
        attemptCount: 0,
        lastResult: null,
        lastFailureReason: null,
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

    return withWriteLock(taskRoot, async () => {
      const manualSuffix = await this.resolveAvailableManualSuffix(task, (suffix) =>
        this.buildEvidenceFiles(phaseId, suffix)
      );

      return {
        taskId: task.id,
        phaseId,
        evidenceFiles: await this.writeEvidence(task, phaseId, manualSuffix),
      };
    });
  }

  async createSnapshot(taskId: string): Promise<SnapshotResult> {
    const task = await this.taskStore.getTask(taskId);
    this.assertTaskIsActive(task);

    const workflow = await this.workflowLoader.resolve(task.workflow);
    const { phaseId, definition } = this.phaseResolver.resolveCurrentPhase(task, workflow.definition);
    const promptSnapshot = await this.renderResolvedPhase(task, workflow, phaseId, definition);
    const taskRoot = this.getAbsoluteTaskRoot(task);

    return withWriteLock(taskRoot, async () => {
      const manualSuffix = await this.resolveAvailableManualSuffix(task, (suffix) => [
        this.buildManualSnapshotFile(phaseId, suffix),
      ]);

      return {
        taskId: task.id,
        phaseId,
        snapshotFiles: await this.writeSnapshots(
          task,
          phaseId,
          promptSnapshot,
          'manual',
          DEFAULT_PROMPT_CONTEXT_MODE,
          '',
          manualSuffix
        ),
      };
    });
  }

  private async renderResolvedPhase(
    task: TaskRecord,
    workflow: ResolvedWorkflow,
    phaseId: string,
    definition: PhaseDefinition,
    options: PromptRenderOptions = {}
  ): Promise<string> {
    await this.assertContextRefsExist(task);
    const contextMode = options.contextMode ?? DEFAULT_PROMPT_CONTEXT_MODE;
    const renderedTemplateVariables = await this.templateRenderer.discoverPlaceholderNames(
      definition.template,
      workflow.templateDir
    );
    const variables = this.resolveAndAssertRequiredVariables(
      task,
      workflow,
      phaseId,
      definition,
      renderedTemplateVariables
    );
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
    definition: PhaseDefinition,
    additionalDemandedVariables?: Iterable<string>
  ): Record<string, string> {
    const variables = this.variableResolver.resolve(task, phaseId, workflow.definition, definition, {
      additionalDemandedVariables,
    });
    const declarations = mergeVariableDeclarations(workflow.definition.variables, definition.variables);
    assertRequiredVariables(workflow.id, phaseId, definition, declarations, variables);
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
          const content = await readTextFile(await resolveContainedPath(this.workspaceRoot, ref.path));
          const summary = summarizeContextContent(content);
          return `- \`${ref.path}\` (role: ${ref.role}, source: ${ref.source})${summary ? `: ${summary}` : ''}`;
        })
      );
      const compactPrompt = removeRenderedContextVariableBlocks(prompt);
      return `${compactPrompt.trimEnd()}\n\n## Compact Context Summary\n\n${summaries.join('\n')}\n`;
    }

    const sections = await Promise.all(
      refs.map(async (ref) => {
        const content = await readTextFile(await resolveContainedPath(this.workspaceRoot, ref.path));
        const formattedContent = formatContextBodyContent(content);
        return [
          `### ${ref.path}`,
          '',
          `role: ${ref.role}`,
          `source: ${ref.source}`,
          '',
          '```',
          formattedContent,
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
    const current = workflow.phases[currentPhaseId];
    if (current?.next === null) return null;
    if (current?.next === undefined && workflow.phaseOrder.at(-1) === currentPhaseId) return null;
    return this.phaseResolver.resolveNextPhase({ ...task, currentPhase: currentPhaseId }, workflow).phaseId;
  }

  private resolveValidationTemplate(workflow: ResolvedWorkflow, definition: PhaseDefinition): string | undefined {
    const templatePath = definition.completion?.validationTemplate;
    if (!templatePath) {
      return undefined;
    }
    return path.join('workflow', workflow.id, 'templates', templatePath);
  }

  private async resolveFinalizedArtifacts(
    task: TaskRecord,
    workflow: ResolvedWorkflow,
    phaseId: string,
    definition: PhaseDefinition
  ): Promise<FinalizedWorkflowArtifact[]> {
    const artifacts = workflow.definition.artifacts ?? {};
    const artifactPathVariables = Object.values(artifacts).flatMap((artifact) =>
      extractPlaceholderNames(artifact.path)
    );
    const variables = this.resolveAndAssertRequiredVariables(
      task,
      workflow,
      phaseId,
      definition,
      artifactPathVariables
    );

    return Promise.all(
      Object.entries(artifacts).map(async ([role, artifact]) => {
        const artifactPath = renderInlineTemplate(artifact.path, variables);
        const resolvedPath = path.isAbsolute(artifactPath)
          ? artifactPath
          : path.resolve(this.workspaceRoot, artifactPath);
        let exists = true;
        try {
          await access(resolvedPath);
        } catch {
          exists = false;
        }

        return {
          role,
          path: artifactPath,
          exists,
          ...(artifact.kind !== undefined ? { kind: artifact.kind } : {}),
          ...(artifact.description !== undefined ? { description: artifact.description } : {}),
        };
      })
    );
  }

  private buildCompletionOperatorGuidance(
    task: TaskRecord,
    isWorkflowComplete: boolean
  ): CompletionOperatorGuidance {
    if (isWorkflowComplete) {
      return {
        recommendedNextAction: 'Inspect the completed task and finalized artifact paths returned in this response.',
        validNextMcpCalls: [
          'playspec_get_task',
          'playspec_list_tasks',
        ],
        message: `Workflow "${task.workflow}" is complete for task "${task.id}". Do not call playspec_render_next_prompt for this task unless the task is reopened by a future workflow feature.`,
      };
    }

    return {
      recommendedNextAction: 'Render the next phase prompt and continue the workflow.',
      validNextMcpCalls: [
        'playspec_render_next_prompt',
        'playspec_render_phase_prompt',
        'playspec_complete_phase',
        'playspec_get_task',
        'playspec_list_tasks',
      ],
      message: `Workflow "${task.workflow}" advanced to phase "${task.currentPhase}".`,
    };
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

  private async writeCompletionEvent(input: {
    feedbackRequest?: CompletionFeedbackCaptureInput;
    validationReportFile?: string;
    completionInput: CompletePhaseInput;
    requestId?: string;
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
      ...(input.validationReportFile ? { validationReportFile: input.validationReportFile } : {}),
      ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
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
    await this.completionTransactionStore.prepare(input.task, event, input.completionInput, markdown, input.feedbackRequest);
    const committed = await this.completionTransactionStore.recover(input.task.id);
    if (!committed) throw new Error('Prepared completion transaction disappeared.');
    return committed;
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
      path.join(task.paths.taskRoot, taskRootRelativePath).replace(/\\/g, '/');
    const evidence = event.evidenceFiles.map((file) => `- ${displayPath(file)}`).join('\n') || '- none';
    const snapshots = event.snapshotFiles.map((file) => `- ${displayPath(file)}`).join('\n') || '- none';
    const review = event.reviewFile ? `- ${displayPath(event.reviewFile)}` : '- none';
    const feedback = event.feedback ? `\n## Feedback\n\n${renderCompletionFeedback(event.feedback)}\n` : '';
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

  private getAbsoluteTaskRoot(task: TaskRecord): string {
    return getActiveTaskRoot(this.workspaceRoot, task.id);
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
      const record = HarnessRecordSchema.parse(parseYaml(content) as unknown);
      return record.phaseId === phaseId
        ? record
        : this.createDefaultHarnessRecord(task.id, phaseId, record.resetEvents);
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
        await access(await resolveContainedPath(workspaceRoot, ref.path));
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
    completionSuffix = '',
    manualSuffix = '_manual'
  ): Promise<string[]> {
    const taskSnapshotFile =
      mode === 'completion'
        ? `snapshots/phase${phaseId}${completionSuffix}_before_complete.yaml`
        : this.buildManualSnapshotFile(phaseId, manualSuffix);

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

      const evidenceFiles = this.buildEvidenceFiles(phaseId, suffix);

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

  private buildEvidenceFiles(phaseId: string, suffix: string): string[] {
    return [
      `evidence/phase${phaseId}${suffix}_git_status.txt`,
      `evidence/phase${phaseId}${suffix}_git_diff_stat.txt`,
      `evidence/phase${phaseId}${suffix}_changed_files.txt`,
    ];
  }

  private buildManualSnapshotFile(phaseId: string, suffix: string): string {
    return `snapshots/phase${phaseId}${suffix}_task.yaml`;
  }

  private async resolveAvailableManualSuffix(
    task: TaskRecord,
    buildCandidatePaths: (suffix: string) => string[]
  ): Promise<string> {
    for (let index = 1; ; index += 1) {
      const suffix = index === 1 ? '_manual' : `_manual${index}`;
      const candidatePaths = buildCandidatePaths(suffix);
      const hasCollision = await this.anyTaskArtifactExists(task, candidatePaths);
      if (!hasCollision) {
        return suffix;
      }
    }
  }

  private async anyTaskArtifactExists(task: TaskRecord, taskRelativePaths: string[]): Promise<boolean> {
    const taskRoot = this.getAbsoluteTaskRoot(task);
    for (const taskRelativePath of taskRelativePaths) {
      try {
        await access(path.join(taskRoot, taskRelativePath));
        return true;
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          continue;
        }
        throw error;
      }
    }

    return false;
  }

  private async writeReview(
    task: TaskRecord,
    phaseId: string,
    validationTemplate?: string,
    completionSuffix = ''
  ): Promise<string> {
    const reviewFile = `reviews/phase${phaseId}${completionSuffix}_review.yaml`;
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

function removeRenderedContextVariableBlocks(prompt: string): string {
  const lines = prompt.split('\n');
  const kept: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isContextVariableHeading(line)) {
      while (index + 1 < lines.length && isContextVariableValueLine(lines[index + 1])) {
        index += 1;
      }
      continue;
    }
    kept.push(line);
  }

  return kept.join('\n');
}

function isContextVariableHeading(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '- CONTEXT_FILES:' || trimmed === '- CONTEXT_REFS_DETAIL:';
}

function isContextVariableValueLine(line: string): boolean {
  return /^- (`|\(none\))/.test(line.trim());
}

function formatContextBodyContent(content: string): string {
  return content
    .trimEnd()
    .split('\n')
    .flatMap((line) => wrapLongContextLine(line))
    .join('\n');
}

function wrapLongContextLine(line: string): string[] {
  if (line.length <= CONTEXT_BODY_MAX_LINE_LENGTH) {
    return [line];
  }

  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += CONTEXT_BODY_MAX_LINE_LENGTH) {
    chunks.push(line.slice(index, index + CONTEXT_BODY_MAX_LINE_LENGTH));
  }
  return chunks;
}

function safeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'completion';
}

const INLINE_PLACEHOLDER_REGEX = /\{\{([^}#/^!>][^}]*)\}\}/g;

function extractPlaceholderNames(template: string): string[] {
  const names: string[] = [];
  template.replace(INLINE_PLACEHOLDER_REGEX, (token, name: string) => {
    names.push(name.trim());
    return token;
  });
  return names;
}

function renderInlineTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(INLINE_PLACEHOLDER_REGEX, (token, name: string) => {
    const value = variables[name.trim()];
    return value === undefined ? token : value;
  });
}
