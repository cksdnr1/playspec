// Phase 0 skeleton — expanded in Phase 1
export type TaskId = string;
export type PhaseId = string;
export type WorkflowId = string;

export type TaskStatus = 'active' | 'completed' | 'archived';
export type WorkflowMode = 'linear';
export type TaskLinkType = 'parent' | 'after' | 'related';

export interface TaskLink {
  type: TaskLinkType;
  targetTaskId: string;
  createdAt: string;
  createdBy?: 'cli' | 'manual' | 'import' | 'agent';
}

export interface TaskTarget {
  phaseNumber: string;
}

export interface TaskContextRef {
  path: string;
  role: 'planning-context' | 'source-problem';
  source: TaskId;
}

export interface TaskPaths {
  taskRoot: string;
  projectDocRoot: string;
}

export interface PhaseHistoryEntry {
  phase: PhaseId;
  status: 'active' | 'completed';
  completedAt?: string;
  reviewFile?: string;
  evidenceFiles?: string[];
  snapshotFiles?: string[];
  validationTemplate?: string;
  result?: string;
  visitCount?: number;
}

export interface TaskRecord {
  id: TaskId;
  title: string;
  workflow: WorkflowId;
  status: TaskStatus;
  workflowMode: WorkflowMode;
  currentPhase: PhaseId | null;
  createdAt: string;
  updatedAt: string;
  paths: TaskPaths;
  variables: Record<string, string>;
  phaseHistory: PhaseHistoryEntry[];
  stateSync?: TaskStateSync;
  rollback?: TaskRollbackState;
  target?: TaskTarget;
  contextRefs?: TaskContextRef[];
  links?: TaskLink[];
}

export interface TaskStateSync {
  lastKnownGitHead: string | null;
  lastCompletedAt: string | null;
}

export interface TaskRollbackState {
  lastSafePoint: RollbackSafePoint | null;
}

export interface RollbackSafePoint {
  id: string;
  createdAt: string;
  phase: PhaseId;
  gitHead: string | null;
  taskSnapshotFile: string;
  promptSnapshotFile?: string;
}

export interface TaskSummary {
  id: TaskId;
  title: string;
  status: TaskStatus;
  currentPhase: PhaseId | null;
  workflow: WorkflowId;
}

export interface CreateTaskInput {
  id: TaskId;
  title: string;
  workflow: WorkflowId;
  currentPhase?: PhaseId | null;
  variables?: Record<string, string>;
  target?: TaskTarget;
  contextRefs?: TaskContextRef[];
  links?: TaskLink[];
}

export interface TaskLinkMutationResult {
  sourceTaskId: TaskId;
  targetTaskId: TaskId;
  type?: TaskLinkType;
  changed: boolean;
  warning?: string;
}

export interface PhaseDefinition {
  title: string;
  template: string;
  stepNumber?: string;
  stepTitle?: string;
  variables?: Record<string, VariableDeclaration>;
  requiredVariables?: string[];
  outputs?: string[];
  completion?: {
    validationTemplate?: string;
    eventType?: string;
  };
  gate?: {
    results: string[];
    nextByResult: Record<string, PhaseId>;
    eventTypes?: Record<string, string>;
  };
  next?: PhaseId | null;
  results?: string[];
  nextByResult?: Record<string, PhaseId>;
  eventTypes?: Record<string, string>;
  maxVisits?: number;
}

export interface WorkflowDefinition {
  id: string;
  name?: string;
  description?: string;
  version?: string | number;
  builtinShadow?: WorkflowBuiltinShadowAcknowledgement;
  mode: WorkflowMode;
  variables?: Record<string, VariableDeclaration>;
  artifacts?: Record<string, ArtifactDeclaration>;
  phaseOrder: PhaseId[];
  phases: Record<PhaseId, PhaseDefinition>;
}

export interface WorkflowBuiltinShadowAcknowledgement {
  accepted?: boolean;
}

export interface VariableDeclaration {
  required?: boolean;
  default?: string;
  description?: string;
}

export interface ArtifactDeclaration {
  path: string;
  kind?: string;
  description?: string;
}

export type WorkflowSource = 'project' | 'user' | 'builtin';
export type WorkflowInstallDestination = 'project' | 'user' | 'skip';

export interface ResolvedWorkflow {
  id: string;
  rootDir: string;
  templateDir: string;
  source: WorkflowSource;
  shadow?: WorkflowBuiltinShadow;
  definition: WorkflowDefinition;
}

export interface WorkflowBuiltinShadow {
  effectiveSource: WorkflowSource;
  shadowSource: Exclude<WorkflowSource, 'builtin'>;
  shadowRootDir: string;
  builtinRootDir: string;
  differsFromBuiltin: boolean;
  accepted: boolean;
  usingBuiltinFallback: boolean;
}

export interface SessionRecord {
  sessionId: string;
  adapter: string;
  currentTaskId: TaskId | null;
}

export interface CompletePhaseInput {
  phaseId: PhaseId;
  nextPhase: PhaseId | null;
  reviewFile?: string;
  evidenceFiles: string[];
  snapshotFiles: string[];
  validationTemplate?: string;
  stateSync?: TaskStateSync;
  rollback?: TaskRollbackState;
  result?: string;
  visitCount?: number;
}

export type DesyncSeverity = 'none' | 'low' | 'medium' | 'high';

export interface DesyncCheckResult {
  taskId: TaskId;
  severity: DesyncSeverity;
  currentGitHead: string | null;
  lastKnownGitHead: string | null;
  changedFiles: string[];
  deletedFiles: string[];
  renamedFiles: string[];
  untrackedFiles: string[];
  reasons: string[];
  recommendedAction: string;
}

export interface RollbackPlanResult {
  taskId: TaskId;
  safePoint: RollbackSafePoint;
  currentGitHead: string | null;
  lastKnownGitHead: string | null;
  changedFiles: string[];
  deletedFiles: string[];
  renamedFiles: string[];
  untrackedFiles: string[];
  affectedCommits: string[];
  canExecuteGitRollback: boolean;
  safetyReasons: string[];
  recommendedAction: string;
  confirmCommand: string | null;
}

export interface RollbackExecutionResult {
  taskId: TaskId;
  mode: 'state-only' | 'git-only';
  restoredSnapshotFile?: string;
  quarantinedFiles?: string[];
  plan?: RollbackPlanResult;
  message: string;
}

export interface EvidenceResult {
  taskId: TaskId;
  phaseId: PhaseId;
  evidenceFiles: string[];
}

export interface SnapshotResult {
  taskId: TaskId;
  phaseId: PhaseId;
  snapshotFiles: string[];
}

export type PromptContextMode = 'compact' | 'strict' | 'full';

export type PromptGenerationSource = 'prompt' | 'next' | 'complete' | 'mcp';

export interface OmittedPromptContext {
  path: string;
  role: string;
  source: string;
  reason: string;
}

export interface PromptArtifactMetadata {
  promptArtifactPath: string;
  contextMode: PromptContextMode;
  generationSource: PromptGenerationSource;
  taskId: TaskId;
  phaseId?: PhaseId;
  generatedAt: string;
  omittedContext: OmittedPromptContext[];
}

export interface PromptRenderOptions {
  withEvolutionContext?: boolean;
  evolutionContextSource?: PromptGenerationSource;
  contextMode?: PromptContextMode;
}

export interface CompletePhaseOptions {
  withReview?: boolean;
  result?: string;
  withEvolutionContext?: boolean;
  contextMode?: PromptContextMode;
}

export interface CompletionResult {
  taskId: TaskId;
  completedPhase: PhaseId;
  nextPhase: PhaseId | null;
  status: TaskStatus;
  evidenceFiles: string[];
  snapshotFiles: string[];
  reviewFile?: string;
  evolutionContextSnapshotFile?: string;
  completionEvent?: CompletionEvent;
}

export interface CompletionEvent {
  id: string;
  sequence: number;
  taskId: TaskId;
  phase: PhaseId;
  phaseTitle: string;
  completedAt: string;
  type: string;
  result?: string;
  previousPhase: PhaseId | null;
  nextPhase: PhaseId | null;
  statusAfterCompletion: TaskStatus;
  gitHead: string | null;
  evidenceFiles: string[];
  snapshotFiles: string[];
  reviewFile?: string;
  rollbackSafePointId?: string;
  markdownFile: string;
}

export interface CompletionLedger {
  taskId: TaskId;
  events: CompletionEvent[];
}

export interface SetCurrentPhaseResult {
  taskId: TaskId;
  previousPhase: PhaseId | null;
  currentPhase: PhaseId;
}

export type HarnessAttemptResult = 'success' | 'failure';

export interface HarnessResetEvent {
  timestamp: string;
  taskId: TaskId;
  previousBlocked: boolean;
  previousCircuitBreaker: boolean;
  reason?: string;
  source: string;
}

export interface HarnessRecord {
  taskId: TaskId;
  phaseId: PhaseId;
  attemptCount: number;
  retryBudget: number;
  lastResult: HarnessAttemptResult | null;
  lastFailureReason: string | null;
  blocked: boolean;
  circuitBreaker: boolean;
  updatedAt: string;
  resetEvents: HarnessResetEvent[];
}
