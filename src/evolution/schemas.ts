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

export const EvolutionProposalStatusSchema = z.enum(['pending', 'refining', 'skipped', 'applied', 'failed']);
export const HumanEditObservationStatusSchema = z.enum(['recorded', 'ignored', 'superseded']);
export const EvolutionRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export const EvolutionReviewStatusSchema = z.enum(['unreviewed', 'needs_review', 'reviewed']);

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
});

export const EvolutionEvidenceReferenceSchema = z.object({
  path: WorkspaceRelativePathSchema,
  note: z.string().min(1),
  addedAt: z.string(),
  source: z.literal('append-evidence'),
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
