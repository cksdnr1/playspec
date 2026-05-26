export type EvolutionProposalStatus = 'pending' | 'refining' | 'skipped' | 'applied' | 'failed';
export type EvolutionRiskLevel = 'low' | 'medium' | 'high';
export type EvolutionReviewStatus = 'unreviewed' | 'needs_review' | 'reviewed';
export type HumanEditObservationStatus = 'recorded' | 'ignored' | 'superseded';
export type FeedbackApprovalResult = 'approved' | 'needs_revision' | 'failed' | 'skipped';
export type FeedbackSignalResult = 'positive' | 'negative' | 'neutral' | 'parse_failed';
export type FeedbackCauseCategory =
  | 'artifact_quality_issue'
  | 'authoring_prompt_gap'
  | 'validation_prompt_gap'
  | 'workflow_policy_gap'
  | 'extractor_or_parser_error';
export type FeedbackConfidence = 'low' | 'medium' | 'high';
export type FeedbackTrendDirection = 'improving' | 'declining' | 'stable' | 'unknown';
export type FeedbackProposalReadinessState = 'not_ready' | 'ready_for_review' | 'proposal_candidate';
export type FeedbackMutationStrategy = 'manual_review_only';
export type FeedbackPathKind =
  | 'workspace_relative'
  | 'workflow_relative'
  | 'user_home_relative'
  | 'package_relative';
export type ValidationFeedbackExtractionMethod = 'machine_readable_block' | 'markdown_fallback';
export type ValidationFeedbackPromptTargetType = 'workflow_prompt_template';

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
  generationSource?: 'cli';
}

export interface EvolutionEvidenceReference {
  path: string;
  note: string;
  addedAt: string;
  source: 'append-evidence' | 'generated';
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

export interface FeedbackWorkflowSource {
  kind: 'project_local' | 'user_global' | 'bundled_preset' | 'external';
  root: string;
  rootPathKind: FeedbackPathKind;
  packageName?: string;
  presetId?: string;
  version?: string | number;
}

export interface FeedbackTargetPromptTemplate {
  path: string;
  pathKind: FeedbackPathKind;
  writable: boolean;
}

export interface FeedbackPromptSnapshot {
  algorithm: 'sha256';
  hash: string;
  renderedByteLength: number;
  targetPhaseId: string;
  templatePath: string;
  templatePathKind: FeedbackPathKind;
  createdAt: string;
  workflowVersion?: string | number;
}

export interface FeedbackDedupeKey {
  version: 1;
  workflowId: string;
  feedbackKind: 'prompt_evolution_signal';
  sourcePhaseId: string;
  evaluatedArtifactPhaseId: string;
  evolutionTargetPhaseId: string;
  causeCategory: FeedbackCauseCategory;
  fields: Record<string, string>;
}

export interface FeedbackHistoryOverflowSummary {
  omittedEventCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  parseFailureCount: number;
  firstOmittedAt?: string;
  lastOmittedAt?: string;
}

export interface FeedbackCompactHistoryPolicy {
  maxEntries: number;
  keepFirst: boolean;
  keepLatest: number;
  summarizeOverflow: boolean;
}

export interface FeedbackProposalReadinessPolicy {
  mode: 'manual_only_initial';
  minRunCount: number;
  minNegativeCount: number;
  minConfidence: FeedbackConfidence;
  requireHumanReviewBeforeProposal: boolean;
}

export interface FeedbackCauseClassification {
  selected: FeedbackCauseCategory;
  confidence: FeedbackConfidence;
  summary?: string;
}

export interface ValidationFeedbackPromptEvolution {
  targetType: ValidationFeedbackPromptTargetType;
  guidance?: string;
}

export interface ValidationFeedbackThresholdResult {
  threshold: number;
}

export interface ValidationFeedbackExtractionInput {
  task: import('#core/types.js').TaskRecord;
  workflow: import('#core/types.js').ResolvedWorkflow;
  feedbackConfig: import('#core/types.js').PhaseFeedbackConfig;
  phaseId: string;
  artifactContent: string;
  artifactPath?: string;
  completionResult?: FeedbackApprovalResult;
  createdAt?: string;
}

export interface ValidationFeedbackExtraction {
  method: ValidationFeedbackExtractionMethod;
  confidence: FeedbackConfidence;
  sourcePhaseId: string;
  evaluatedArtifactPhaseId: string;
  evolutionTargetPhaseId: string;
  score?: number;
  approval: ValidationFeedbackThresholdResult & { result: FeedbackApprovalResult };
  feedback: ValidationFeedbackThresholdResult & { result: FeedbackSignalResult };
  causeClassification: FeedbackCauseClassification;
  promptEvolution: ValidationFeedbackPromptEvolution;
  workflowSource: FeedbackWorkflowSource;
  targetPromptTemplate: FeedbackTargetPromptTemplate;
  targetWritable: boolean;
  targetPath: string;
  summary: string;
  rawObservationRef?: string;
  dedupeFieldValues?: Record<string, string>;
}

export interface FeedbackThreadEvent {
  eventId: string;
  taskId: string;
  phaseId: string;
  createdAt: string;
  approvalResult: FeedbackApprovalResult;
  feedbackResult: FeedbackSignalResult;
  score?: number;
  causeClassification: FeedbackCauseClassification;
  summary: string;
  promptSnapshot: FeedbackPromptSnapshot;
  rawObservationRef?: string;
}

export interface FeedbackTrendState {
  totalEvents: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  parseFailureCount: number;
  direction: FeedbackTrendDirection;
  confidence: FeedbackConfidence;
  readinessState: FeedbackProposalReadinessState;
  lastEventAt?: string;
}

export interface FeedbackThread {
  id: string;
  createdAt: string;
  updatedAt: string;
  dedupeKey: FeedbackDedupeKey;
  dedupeKeyHash: string;
  sourcePhaseId: string;
  evaluatedArtifactPhaseId: string;
  evolutionTargetPhaseId: string;
  workflowSource: FeedbackWorkflowSource;
  targetPromptTemplate: FeedbackTargetPromptTemplate;
  targetWritable: boolean;
  targetPath: string;
  compactHistoryPolicy: FeedbackCompactHistoryPolicy;
  proposalReadinessPolicy: FeedbackProposalReadinessPolicy;
  mutationStrategy: FeedbackMutationStrategy;
  trend: FeedbackTrendState;
  events: FeedbackThreadEvent[];
  historyOverflowSummary?: FeedbackHistoryOverflowSummary;
}

export interface FeedbackRawObservationEvent {
  id: string;
  threadId: string;
  taskId: string;
  phaseId: string;
  createdAt: string;
  approvalResult: FeedbackApprovalResult;
  feedbackResult: FeedbackSignalResult;
  score?: number;
  causeClassification: FeedbackCauseClassification;
  summary: string;
  raw?: unknown;
}

export interface FeedbackThreadUpdateInput {
  task: import('#core/types.js').TaskRecord;
  workflow: import('#core/types.js').ResolvedWorkflow;
  feedbackConfig: import('#core/types.js').PhaseFeedbackConfig;
  evolutionTargetPhaseId?: string;
  phaseId: string;
  approvalResult: FeedbackApprovalResult;
  feedbackResult: FeedbackSignalResult;
  causeClassification: FeedbackCauseClassification;
  summary: string;
  score?: number;
  rawObservationRef?: string;
  createdAt?: string;
  dedupeFieldValues?: Record<string, string>;
}

export interface FeedbackThreadUpdateResult {
  thread: FeedbackThread;
  threadPath: string;
  created: boolean;
}

export interface AppendFeedbackThreadEvidenceInput {
  proposalId: string;
  threadId: string;
}

export interface AppendFeedbackThreadEvidenceResult {
  proposal: EvolutionProposal;
  proposalPath: string;
  validationPath: string;
  revisionPath: string;
  threadId: string;
  threadPath: string;
  evidencePath: string;
  evidenceNote: string;
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
