export type MigrationMode = 'review' | 'dry-run' | 'auto';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Confidence = 'deterministic' | 'high' | 'medium' | 'low';

// 'delete_file' is intentionally absent — it is not a supported action type.
export type ActionType =
  | 'update_file'
  | 'append_section'
  | 'replace_section'
  | 'update_task_state'
  | 'add_context_ref'
  | 'remove_context_ref'
  | 'archive_file';

interface BaseAction {
  actionId: string;
  targetPath: string;
  sourcePaths: string[];
  reason: string;
  evidence: string;
  riskLevel: RiskLevel;
  preview: string;
  backupRequired: boolean;
  requiresReview: boolean;
}

export interface UpdateFileAction extends BaseAction {
  type: 'update_file';
  content: string;
}

export interface AppendSectionAction extends BaseAction {
  type: 'append_section';
  sectionContent: string;
}

export interface ReplaceSectionAction extends BaseAction {
  type: 'replace_section';
  sectionName: string;
  sectionContent: string;
}

export interface UpdateTaskStateAction extends BaseAction {
  type: 'update_task_state';
  fieldPath: string;
  previousValue?: unknown;
  proposedValue?: unknown;
}

export interface ContextRefValue {
  path: string;
  role: 'planning-context';
  source: string;
}

export interface AddContextRefAction extends BaseAction {
  type: 'add_context_ref';
  contextRef: ContextRefValue;
}

export interface RemoveContextRefAction extends BaseAction {
  type: 'remove_context_ref';
  refPath: string;
}

export interface ArchiveFileAction extends BaseAction {
  type: 'archive_file';
}

export type MigrationAction =
  | UpdateFileAction
  | AppendSectionAction
  | ReplaceSectionAction
  | UpdateTaskStateAction
  | AddContextRefAction
  | RemoveContextRefAction
  | ArchiveFileAction;

export interface StatePromotion {
  fieldPath: string;
  previousValue?: unknown;
  proposedValue?: unknown;
  evidenceSources: string[];
  confidence: Confidence;
  reason: string;
  requiresReview: boolean;
}

export interface MigrationPlan {
  id: string;
  createdAt: string;
  mode: MigrationMode;
  sourceRoot: string;
  targetTaskId: string;
  sourceFiles: string[];
  targetFiles: string[];
  actions: MigrationAction[];
  statePromotions: StatePromotion[];
  riskLevel: RiskLevel;
  requiresReview: boolean;
  summary: string;
  warnings: string[];
}

export type ActionStatus = 'applied' | 'skipped' | 'rejected' | 'failed';

export interface MigrationActionReport {
  actionId: string;
  type: ActionType;
  status: ActionStatus;
  reason?: string;
  backupPath?: string;
}

export interface MigrationReport {
  planId: string;
  createdAt: string;
  mode: MigrationMode;
  targetTaskId: string;
  actionReports: MigrationActionReport[];
  summary: string;
}
