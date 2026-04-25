// Phase 0 skeleton — expanded in Phase 1
export type TaskId = string;
export type PhaseId = string;
export type WorkflowType = string;

export type TaskStatus = 'active' | 'completed' | 'archived';
export type WorkflowMode = 'linear';

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
}

export interface TaskSummary {
  id: TaskId;
  title: string;
  status: TaskStatus;
  currentPhase: PhaseId | null;
}

export interface CreateTaskInput {
  id: TaskId;
  title: string;
  workflowType: WorkflowType;
}

export interface PhaseDefinition {
  title: string;
  template: string;
  requiredVariables?: string[];
  outputs?: string[];
  completion?: {
    validationTemplate?: string;
  };
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
