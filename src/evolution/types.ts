export type EvolutionProposalStatus = 'pending' | 'refining' | 'skipped' | 'applied' | 'failed';
export type EvolutionRiskLevel = 'low' | 'medium' | 'high';
export type EvolutionReviewStatus = 'unreviewed' | 'needs_review' | 'reviewed';
export type HumanEditObservationStatus = 'recorded' | 'ignored' | 'superseded';

export interface EvolutionArtifactReference {
  path: string;
  role: 'archived-artifact' | 'task-artifact' | 'supporting-context';
  sourceTaskId?: string;
  archivedTaskId?: string;
}

export interface EvolutionProposalSource {
  taskId?: string;
  archivedTaskId?: string;
  artifactRefs: EvolutionArtifactReference[];
}

export interface EvolutionEvidenceReference {
  path: string;
  note: string;
  addedAt: string;
  source: 'append-evidence';
}

interface BaseEvolutionProposalAction {
  actionId: string;
  summary: string;
  rationale: string;
}

export interface ProposeFileChangeAction extends BaseEvolutionProposalAction {
  type: 'propose_file_change';
  targetPath: string;
  proposedContent?: string;
}

export interface ProposeSectionChangeAction extends BaseEvolutionProposalAction {
  type: 'propose_section_change';
  targetPath: string;
  sectionName: string;
  proposedContent?: string;
}

export interface ProposeContextReferenceAction extends BaseEvolutionProposalAction {
  type: 'propose_context_reference';
  path: string;
}

export interface ReplaceFileAction extends BaseEvolutionProposalAction {
  type: 'replace_file';
  targetPath: string;
  content: string;
}

export interface AppendSectionAction extends BaseEvolutionProposalAction {
  type: 'append_section';
  targetPath: string;
  sectionName: string;
  content: string;
}

export interface ReplaceSectionAction extends BaseEvolutionProposalAction {
  type: 'replace_section';
  targetPath: string;
  sectionName: string;
  content: string;
}

export type EvolutionProposalAction =
  | ProposeFileChangeAction
  | ProposeSectionChangeAction
  | ProposeContextReferenceAction
  | ReplaceFileAction
  | AppendSectionAction
  | ReplaceSectionAction;

export type EvolutionExecutableAction =
  | ReplaceFileAction
  | AppendSectionAction
  | ReplaceSectionAction;

export interface EvolutionReview {
  status: EvolutionReviewStatus;
  reviewer?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface EvolutionProposal {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  status: EvolutionProposalStatus;
  source: EvolutionProposalSource;
  targetFiles: string[];
  evidenceRefs: EvolutionEvidenceReference[];
  riskLevel: EvolutionRiskLevel;
  actions: EvolutionProposalAction[];
  rationale: string;
  review: EvolutionReview;
  skippedAt?: string;
  skipReason?: string;
  latestApplyReportPath?: string;
}

export type EvolutionValidationStatus = 'valid' | 'invalid';

export interface EvolutionProposalValidationReport {
  proposalId: string;
  createdAt: string;
  status: EvolutionValidationStatus;
  errors: string[];
  warnings: string[];
  checkedPaths: string[];
  summary: string;
}

export interface EvolutionProposalValidationResult {
  valid: boolean;
  proposal?: EvolutionProposal;
  report: EvolutionProposalValidationReport;
}

export type EvolutionApplyStatus = 'success' | 'failed';
export type EvolutionApplyValidationStatus = 'passed' | 'failed';

export interface EvolutionApplyActionReport {
  actionId: string;
  type: EvolutionExecutableAction['type'];
  targetPath: string;
  status: 'applied' | 'failed';
  summary: string;
  error?: string;
}

export interface EvolutionApplyValidationReport {
  path: string;
  status: EvolutionApplyValidationStatus;
  checks: string[];
  errors: string[];
}

export interface EvolutionApplyReport {
  proposalId: string;
  proposalRevision: number;
  createdAt: string;
  approvalSource: string;
  targetFiles: string[];
  actions: EvolutionApplyActionReport[];
  beforeHashes: Record<string, string>;
  afterHashes: Record<string, string>;
  changedFiles: string[];
  validation: EvolutionApplyValidationReport[];
  status: EvolutionApplyStatus;
  failedAction?: string;
  partialApply: boolean;
  recoveryGuidance: string;
  backupPath: string;
}

export interface EvolutionDiffResult {
  proposalId: string;
  proposalRevision: number;
  targetFiles: string[];
  beforeHashes: Record<string, string>;
  afterHashes: Record<string, string>;
  changedFiles: string[];
  fileDiffs: Record<string, string>;
  summary: string[];
}

export interface EvolutionApplyResult {
  report: EvolutionApplyReport;
  reportPath: string;
  backupPath: string;
}

export interface HumanEditObservation {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: HumanEditObservationStatus;
  targetPath: string;
  summary: string;
  rationale: string;
  sourceTaskId?: string;
  proposalId?: string;
  beforeRef?: string;
  afterRef?: string;
  statusReason?: string;
}

export type EvolutionContextGenerationSource = 'prompt' | 'next' | 'complete' | 'mcp';

export interface EvolutionProposalPromptSummary {
  id: string;
  status: Extract<EvolutionProposalStatus, 'pending' | 'refining'>;
  revision: number;
  updatedAt: string;
  sourceTaskId?: string;
  archivedTaskId?: string;
  artifactRefCount: number;
  evidenceRefCount: number;
  targetFiles: string[];
  riskLevel: EvolutionRiskLevel;
}

export interface EvolutionContextSnapshot {
  taskId: string;
  phaseId: string;
  proposalIds: string[];
  humanEditObservationIds: string[];
  omittedProposalCount: number;
  omittedHumanEditObservationCount: number;
  generatedAt: string;
  generationSource: EvolutionContextGenerationSource;
}

export interface EvolutionContextResult {
  proposals: EvolutionProposal[];
  humanEditObservations: HumanEditObservation[];
  proposalSummaries: EvolutionProposalPromptSummary[];
  omittedProposalCount: number;
  omittedHumanEditObservationCount: number;
}
