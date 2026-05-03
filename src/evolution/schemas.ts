import path from 'node:path';
import { z } from 'zod';

export const EvolutionProposalIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Proposal ID must be filesystem-safe.');

export const EvolutionProposalStatusSchema = z.enum(['pending', 'skipped']);
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

export const EvolutionProposalActionSchema = z.discriminatedUnion('type', [
  ProposeFileChangeActionSchema,
  ProposeSectionChangeActionSchema,
  ProposeContextReferenceActionSchema,
]);

export const EvolutionReviewSchema = z.object({
  status: EvolutionReviewStatusSchema,
  reviewer: z.string().optional(),
  reviewedAt: z.string().optional(),
  notes: z.string().optional(),
});

export const EvolutionProposalSchema = z.object({
  id: EvolutionProposalIdSchema,
  createdAt: z.string(),
  status: EvolutionProposalStatusSchema,
  source: EvolutionProposalSourceSchema,
  targetFiles: z.array(WorkspaceRelativePathSchema),
  riskLevel: EvolutionRiskLevelSchema,
  actions: z.array(EvolutionProposalActionSchema).min(1),
  rationale: z.string().min(1),
  review: EvolutionReviewSchema,
  skippedAt: z.string().optional(),
  skipReason: z.string().optional(),
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
