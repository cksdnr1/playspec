// Phase 0 skeleton — expanded in Phase 1
export type TaskId = string;
export type PhaseId = string;
export type WorkflowType = string;

export type TaskStatus = 'active' | 'completed' | 'archived';
export type WorkflowMode = 'linear';

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
  workflowType: WorkflowType;
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
  workflowType: WorkflowType;
}

export interface CreateTaskInput {
  id: TaskId;
  title: string;
  workflowType: WorkflowType;
  variables?: Record<string, string>;
  target?: TaskTarget;
  contextRefs?: TaskContextRef[];
}

export interface PhaseDefinition {
  title: string;
  template: string;
  stepNumber?: string;
  stepTitle?: string;
  requiredVariables?: string[];
  outputs?: string[];
  completion?: {
    validationTemplate?: string;
  };
  gate?: {
    results: string[];
    nextByResult: Record<string, PhaseId>;
  };
  results?: string[];
  nextByResult?: Record<string, PhaseId>;
  maxVisits?: number;
}

export interface WorkflowDefinition {
  id: string;
  mode: WorkflowMode;
  phaseOrder: PhaseId[];
  phases: Record<PhaseId, PhaseDefinition>;
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

export interface CompletionResult {
  taskId: TaskId;
  completedPhase: PhaseId;
  nextPhase: PhaseId | null;
  status: TaskStatus;
  evidenceFiles: string[];
  snapshotFiles: string[];
  reviewFile?: string;
}
