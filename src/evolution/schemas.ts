import path from 'node:path';
import { z } from 'zod';

export const EvolutionProposalIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Proposal ID must be filesystem-safe.');

export const HumanEditObservationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Human edit observation ID must be filesystem-safe.');

export const FeedbackThreadIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Feedback thread ID must be filesystem-safe.');

export const FeedbackPathSegmentSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'Feedback path segment must be filesystem-safe.');

export const EvolutionProposalStatusSchema = z.enum(['pending', 'refining', 'skipped', 'applied', 'failed']);
export const HumanEditObservationStatusSchema = z.enum(['recorded', 'ignored', 'superseded']);
export const EvolutionRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export const EvolutionReviewStatusSchema = z.enum(['unreviewed', 'needs_review', 'reviewed']);
export const FeedbackApprovalResultSchema = z.enum(['approved', 'needs_revision', 'failed', 'skipped']);
export const FeedbackSignalResultSchema = z.enum(['positive', 'negative', 'neutral', 'parse_failed']);
export const FeedbackCauseCategorySchema = z.enum([
  'artifact_quality_issue',
  'authoring_prompt_gap',
  'validation_prompt_gap',
  'workflow_policy_gap',
  'extractor_or_parser_error',
]);
export const FeedbackConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const FeedbackTrendDirectionSchema = z.enum(['improving', 'declining', 'stable', 'unknown']);
export const FeedbackProposalReadinessStateSchema = z.enum(['not_ready', 'ready_for_review', 'proposal_candidate']);
export const FeedbackMutationStrategySchema = z.enum(['manual_review_only']);
export const FeedbackPathKindSchema = z.enum([
  'workspace_relative',
  'workflow_relative',
  'user_home_relative',
  'package_relative',
]);

export const WorkspaceRelativePathSchema = z.string().superRefine((value, ctx) => {
  if (value.trim() === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Path must not be empty.' });
    return;
  }

  if (path.isAbsolute(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Path must be workspace-relative.' });
    return;
  }

  const normalized = path.normalize(value);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Path must not escape the workspace.' });
  }
});

export const EvolutionArtifactReferenceSchema = z.object({
  path: WorkspaceRelativePathSchema,
  role: z.enum(['archived-artifact', 'task-artifact', 'supporting-context']),
  sourceTaskId: z.string().optional(),
  archivedTaskId: z.string().optional(),
});

export const EvolutionProposalSourceSchema = z.object({
  taskId: z.string().optional(),
  archivedTaskId: z.string().optional(),
  artifactRefs: z.array(EvolutionArtifactReferenceSchema).default([]),
  generationSource: z.literal('cli').optional(),
});

export const EvolutionEvidenceReferenceSchema = z.object({
  path: WorkspaceRelativePathSchema,
  note: z.string().min(1),
  addedAt: z.string(),
  source: z.enum(['append-evidence', 'generated']),
});

const BaseEvolutionProposalActionSchema = z.object({
  actionId: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
});

export const ProposeFileChangeActionSchema = BaseEvolutionProposalActionSchema.extend({
  type: z.literal('propose_file_change'),
  targetPath: WorkspaceRelativePathSchema,
  proposedContent: z.string().optional(),
});

export const ProposeSectionChangeActionSchema = BaseEvolutionProposalActionSchema.extend({
  type: z.literal('propose_section_change'),
  targetPath: WorkspaceRelativePathSchema,
  sectionName: z.string().min(1),
  proposedContent: z.string().optional(),
});

export const ProposeContextReferenceActionSchema = BaseEvolutionProposalActionSchema.extend({
  type: z.literal('propose_context_reference'),
  path: WorkspaceRelativePathSchema,
});

export const ReplaceFileActionSchema = BaseEvolutionProposalActionSchema.extend({
  type: z.literal('replace_file'),
  targetPath: WorkspaceRelativePathSchema,
  content: z.string(),
});

export const AppendSectionActionSchema = BaseEvolutionProposalActionSchema.extend({
  type: z.literal('append_section'),
  targetPath: WorkspaceRelativePathSchema,
  sectionName: z.string().min(1),
  content: z.string(),
});

export const ReplaceSectionActionSchema = BaseEvolutionProposalActionSchema.extend({
  type: z.literal('replace_section'),
  targetPath: WorkspaceRelativePathSchema,
  sectionName: z.string().min(1),
  content: z.string(),
});

export const EvolutionProposalActionSchema = z.discriminatedUnion('type', [
  ProposeFileChangeActionSchema,
  ProposeSectionChangeActionSchema,
  ProposeContextReferenceActionSchema,
  ReplaceFileActionSchema,
  AppendSectionActionSchema,
  ReplaceSectionActionSchema,
]);

export const EvolutionExecutableActionSchema = z.discriminatedUnion('type', [
  ReplaceFileActionSchema,
  AppendSectionActionSchema,
  ReplaceSectionActionSchema,
]);

export const EvolutionReviewSchema = z.object({
  status: EvolutionReviewStatusSchema,
  reviewer: z.string().optional(),
  reviewedAt: z.string().optional(),
  notes: z.string().optional(),
});

export const EvolutionProposalSchema = z.object({
  id: EvolutionProposalIdSchema,
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: EvolutionProposalStatusSchema,
  source: EvolutionProposalSourceSchema,
  targetFiles: z.array(WorkspaceRelativePathSchema),
  evidenceRefs: z.array(EvolutionEvidenceReferenceSchema).default([]),
  riskLevel: EvolutionRiskLevelSchema,
  actions: z.array(EvolutionProposalActionSchema).min(1),
  rationale: z.string().min(1),
  review: EvolutionReviewSchema,
  skippedAt: z.string().optional(),
  skipReason: z.string().optional(),
  latestApplyReportPath: WorkspaceRelativePathSchema.optional(),
});

export const HumanEditObservationSchema = z.object({
  id: HumanEditObservationIdSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  status: HumanEditObservationStatusSchema,
  targetPath: WorkspaceRelativePathSchema,
  summary: z.string().min(1),
  rationale: z.string().min(1),
  sourceTaskId: z.string().optional(),
  proposalId: EvolutionProposalIdSchema.optional(),
  beforeRef: WorkspaceRelativePathSchema.optional(),
  afterRef: WorkspaceRelativePathSchema.optional(),
  statusReason: z.string().optional(),
});

export const FeedbackWorkflowSourceSchema = z.object({
  kind: z.enum(['project_local', 'user_global', 'bundled_preset', 'external']),
  root: z.string().min(1),
  rootPathKind: FeedbackPathKindSchema,
  packageName: z.string().min(1).optional(),
  presetId: z.string().min(1).optional(),
  version: z.union([z.string(), z.number()]).optional(),
});

export const FeedbackTargetPromptTemplateSchema = z.object({
  path: z.string().min(1),
  pathKind: FeedbackPathKindSchema,
  writable: z.boolean(),
});

export const FeedbackCompactHistoryPolicySchema = z.object({
  maxEntries: z.number().int().positive(),
  keepFirst: z.boolean(),
  keepLatest: z.number().int().nonnegative(),
  summarizeOverflow: z.boolean(),
}).refine((policy) => policy.keepLatest <= policy.maxEntries, {
  message: 'keepLatest must be less than or equal to maxEntries',
  path: ['keepLatest'],
});

export const FeedbackProposalReadinessPolicySchema = z.object({
  mode: z.enum(['manual_only_initial']),
  minRunCount: z.number().int().positive(),
  minNegativeCount: z.number().int().nonnegative(),
  minConfidence: FeedbackConfidenceSchema,
  requireHumanReviewBeforeProposal: z.boolean(),
});

export const FeedbackCauseClassificationSchema = z.object({
  selected: FeedbackCauseCategorySchema,
  confidence: FeedbackConfidenceSchema,
  summary: z.string().min(1).optional(),
});

export const FeedbackThreadEventSchema = z.object({
  eventId: z.string().min(1),
  taskId: z.string().min(1),
  phaseId: z.string().min(1),
  createdAt: z.string(),
  approvalResult: FeedbackApprovalResultSchema,
  feedbackResult: FeedbackSignalResultSchema,
  score: z.number().min(0).max(100).optional(),
  causeClassification: FeedbackCauseClassificationSchema,
  summary: z.string().min(1),
  rawObservationRef: WorkspaceRelativePathSchema.optional(),
});

export const FeedbackTrendStateSchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  positiveCount: z.number().int().nonnegative(),
  negativeCount: z.number().int().nonnegative(),
  neutralCount: z.number().int().nonnegative(),
  parseFailureCount: z.number().int().nonnegative(),
  direction: FeedbackTrendDirectionSchema,
  confidence: FeedbackConfidenceSchema,
  readinessState: FeedbackProposalReadinessStateSchema,
  lastEventAt: z.string().optional(),
});

export const FeedbackThreadSchema = z.object({
  id: FeedbackThreadIdSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  sourcePhaseId: z.string().min(1),
  evaluatedArtifactPhaseId: z.string().min(1),
  evolutionTargetPhaseId: z.string().min(1),
  workflowSource: FeedbackWorkflowSourceSchema,
  targetPromptTemplate: FeedbackTargetPromptTemplateSchema,
  targetWritable: z.boolean(),
  targetPath: z.string().min(1),
  compactHistoryPolicy: FeedbackCompactHistoryPolicySchema,
  proposalReadinessPolicy: FeedbackProposalReadinessPolicySchema,
  mutationStrategy: FeedbackMutationStrategySchema,
  trend: FeedbackTrendStateSchema,
  events: z.array(FeedbackThreadEventSchema),
});

export const FeedbackRawObservationEventSchema = z.object({
  id: z.string().min(1),
  threadId: FeedbackThreadIdSchema,
  taskId: FeedbackPathSegmentSchema,
  phaseId: FeedbackPathSegmentSchema,
  createdAt: z.string(),
  approvalResult: FeedbackApprovalResultSchema,
  feedbackResult: FeedbackSignalResultSchema,
  score: z.number().min(0).max(100).optional(),
  causeClassification: FeedbackCauseClassificationSchema,
  summary: z.string().min(1),
  raw: z.unknown().optional(),
});

export const EvolutionValidationStatusSchema = z.enum(['valid', 'invalid']);

export const EvolutionProposalValidationReportSchema = z.object({
  proposalId: EvolutionProposalIdSchema,
  createdAt: z.string(),
  status: EvolutionValidationStatusSchema,
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  checkedPaths: z.array(WorkspaceRelativePathSchema),
  summary: z.string(),
});

export const EvolutionApplyStatusSchema = z.enum(['success', 'failed']);
export const EvolutionApplyValidationStatusSchema = z.enum(['passed', 'failed']);

export const EvolutionApplyActionReportSchema = z.object({
  actionId: z.string().min(1),
  type: z.enum(['replace_file', 'append_section', 'replace_section']),
  targetPath: WorkspaceRelativePathSchema,
  status: z.enum(['applied', 'failed']),
  summary: z.string(),
  error: z.string().optional(),
});

export const EvolutionApplyValidationReportSchema = z.object({
  path: WorkspaceRelativePathSchema,
  status: EvolutionApplyValidationStatusSchema,
  checks: z.array(z.string()),
  errors: z.array(z.string()),
});

export const EvolutionApplyReportSchema = z.object({
  proposalId: EvolutionProposalIdSchema,
  proposalRevision: z.number().int().positive(),
  createdAt: z.string(),
  approvalSource: z.string().min(1),
  targetFiles: z.array(WorkspaceRelativePathSchema),
  actions: z.array(EvolutionApplyActionReportSchema),
  beforeHashes: z.record(WorkspaceRelativePathSchema, z.string()),
  afterHashes: z.record(WorkspaceRelativePathSchema, z.string()),
  changedFiles: z.array(WorkspaceRelativePathSchema),
  validation: z.array(EvolutionApplyValidationReportSchema),
  status: EvolutionApplyStatusSchema,
  failedAction: z.string().optional(),
  partialApply: z.boolean(),
  recoveryGuidance: z.string(),
  backupPath: WorkspaceRelativePathSchema,
});

export const EvolutionContextGenerationSourceSchema = z.enum(['prompt', 'next', 'complete', 'mcp']);

export const EvolutionContextSnapshotSchema = z.object({
  taskId: z.string().min(1),
  phaseId: z.string().min(1),
  proposalIds: z.array(EvolutionProposalIdSchema),
  humanEditObservationIds: z.array(HumanEditObservationIdSchema),
  omittedProposalCount: z.number().int().nonnegative(),
  omittedHumanEditObservationCount: z.number().int().nonnegative(),
  generatedAt: z.string(),
  generationSource: EvolutionContextGenerationSourceSchema,
});
