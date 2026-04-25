import { z } from 'zod';

export const TaskPathsSchema = z.object({
  taskRoot: z.string(),
  projectDocRoot: z.string(),
});

export const PhaseHistoryEntrySchema = z.object({
  phase: z.string(),
  status: z.enum(['active', 'completed']),
  completedAt: z.string().optional(),
  reviewFile: z.string().optional(),
  evidenceFiles: z.array(z.string()).optional(),
  snapshotFiles: z.array(z.string()).optional(),
  validationTemplate: z.string().optional(),
});

export const PhaseCompletionSchema = z.object({
  validationTemplate: z.string().optional(),
});

export const TaskRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  workflowType: z.string(),
  status: z.enum(['active', 'completed', 'archived']),
  workflowMode: z.enum(['linear']),
  currentPhase: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paths: TaskPathsSchema,
  variables: z.record(z.string()),
  phaseHistory: z.array(PhaseHistoryEntrySchema),
});

export const TaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'completed', 'archived']),
  currentPhase: z.string().nullable(),
});

export const PhaseDefinitionSchema = z.object({
  title: z.string(),
  template: z.string(),
  requiredVariables: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  completion: PhaseCompletionSchema.optional(),
});

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  mode: z.enum(['linear']),
  phaseOrder: z.array(z.string()),
  phases: z.record(PhaseDefinitionSchema),
});

export const SessionRecordSchema = z.object({
  sessionId: z.string(),
  adapter: z.string(),
  currentTaskId: z.string().nullable(),
});
