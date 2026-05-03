export type EvolutionProposalStatus = 'pending' | 'refining' | 'skipped' | 'applied' | 'failed';
export type EvolutionRiskLevel = 'low' | 'medium' | 'high';
export type EvolutionReviewStatus = 'unreviewed' | 'needs_review' | 'reviewed';

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

export type EvolutionProposalAction =
  | ProposeFileChangeAction
  | ProposeSectionChangeAction
  | ProposeContextReferenceAction;

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
