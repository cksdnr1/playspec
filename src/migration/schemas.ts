import { z } from 'zod';
import path from 'node:path';

const SafeIdSchema = z.string().regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/);
const RelativePathSchema = z.string().min(1).refine(value => {
  const normalized = value.replace(/\\/g, '/');
  return !value.includes('\0') && !path.posix.isAbsolute(normalized) && !path.win32.isAbsolute(value) && !normalized.split('/').includes('..');
}, 'Migration paths must remain workspace-relative without traversal.');

export const MigrationModeSchema = z.enum(['review', 'dry-run', 'auto']);

export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);

export const ConfidenceSchema = z.enum(['deterministic', 'high', 'medium', 'low']);

// 'delete_file' is intentionally absent — it is not a supported action type.
export const ActionTypeSchema = z.enum([
  'update_file',
  'append_section',
  'replace_section',
  'update_task_state',
  'add_context_ref',
  'remove_context_ref',
  'archive_file',
]);

const BaseActionSchema = z.object({
  actionId: SafeIdSchema,
  targetPath: RelativePathSchema,
  sourcePaths: z.array(z.string()),
  reason: z.string(),
  evidence: z.string(),
  riskLevel: RiskLevelSchema,
  preview: z.string(),
  backupRequired: z.boolean(),
  requiresReview: z.boolean(),
});

export const UpdateFileActionSchema = BaseActionSchema.extend({
  type: z.literal('update_file'),
  content: z.string(),
});

export const AppendSectionActionSchema = BaseActionSchema.extend({
  type: z.literal('append_section'),
  sectionContent: z.string(),
});

export const ReplaceSectionActionSchema = BaseActionSchema.extend({
  type: z.literal('replace_section'),
  sectionName: z.string(),
  sectionContent: z.string(),
});

export const UpdateTaskStateActionSchema = BaseActionSchema.extend({
  type: z.literal('update_task_state'),
  fieldPath: z.string(),
  previousValue: z.unknown(),
  proposedValue: z.unknown(),
});

export const ContextRefValueSchema = z.object({
  path: RelativePathSchema,
  role: z.literal('planning-context'),
  source: z.string(),
});

export const AddContextRefActionSchema = BaseActionSchema.extend({
  type: z.literal('add_context_ref'),
  contextRef: ContextRefValueSchema,
});

export const RemoveContextRefActionSchema = BaseActionSchema.extend({
  type: z.literal('remove_context_ref'),
  refPath: RelativePathSchema,
});

export const ArchiveFileActionSchema = BaseActionSchema.extend({
  type: z.literal('archive_file'),
});

export const MigrationActionSchema = z.discriminatedUnion('type', [
  UpdateFileActionSchema,
  AppendSectionActionSchema,
  ReplaceSectionActionSchema,
  UpdateTaskStateActionSchema,
  AddContextRefActionSchema,
  RemoveContextRefActionSchema,
  ArchiveFileActionSchema,
]);

export const StatePromotionSchema = z.object({
  fieldPath: z.string(),
  previousValue: z.unknown(),
  proposedValue: z.unknown(),
  evidenceSources: z.array(z.string()),
  confidence: ConfidenceSchema,
  reason: z.string(),
  requiresReview: z.boolean(),
});

export const MigrationPlanSchema = z.object({
  id: SafeIdSchema,
  createdAt: z.string(),
  mode: MigrationModeSchema,
  sourceRoot: z.string(),
  targetTaskId: SafeIdSchema,
  sourceFiles: z.array(z.string()),
  targetFiles: z.array(RelativePathSchema),
  actions: z.array(MigrationActionSchema),
  statePromotions: z.array(StatePromotionSchema),
  riskLevel: RiskLevelSchema,
  requiresReview: z.boolean(),
  summary: z.string(),
  warnings: z.array(z.string()),
});

export const ActionStatusSchema = z.enum(['applied', 'skipped', 'rejected', 'failed']);

export const MigrationActionReportSchema = z.object({
  actionId: z.string(),
  type: ActionTypeSchema,
  status: ActionStatusSchema,
  reason: z.string().optional(),
  backupPath: z.string().optional(),
});

export const MigrationReportSchema = z.object({
  planId: SafeIdSchema,
  createdAt: z.string(),
  mode: MigrationModeSchema,
  targetTaskId: z.string(),
  actionReports: z.array(MigrationActionReportSchema),
  summary: z.string(),
});
