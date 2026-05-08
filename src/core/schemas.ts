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
  result: z.string().optional(),
  visitCount: z.number().int().positive().optional(),
});

export const PhaseCompletionSchema = z.object({
  validationTemplate: z.string().optional(),
});

export const PhaseGateSchema = z.object({
  results: z.array(z.string()).min(1),
  nextByResult: z.record(z.string()),
});

export const VariableDeclarationSchema = z.object({
  required: z.boolean().optional(),
  default: z.string().optional(),
  description: z.string().optional(),
});

export const ArtifactDeclarationSchema = z.object({
  path: z.string(),
  kind: z.string().optional(),
  description: z.string().optional(),
});

export const TaskStateSyncSchema = z.object({
  lastKnownGitHead: z.string().nullable(),
  lastCompletedAt: z.string().nullable(),
});

export const RollbackSafePointSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  phase: z.string(),
  gitHead: z.string().nullable(),
  taskSnapshotFile: z.string(),
  promptSnapshotFile: z.string().optional(),
});

export const TaskRollbackStateSchema = z.object({
  lastSafePoint: RollbackSafePointSchema.nullable(),
});

export const TaskTargetSchema = z.object({
  phaseNumber: z.string(),
});

export const TaskContextRefSchema = z.object({
  path: z.string(),
  role: z.enum(['planning-context', 'source-problem']),
  source: z.string(),
});

export const TaskLinkSchema = z.object({
  type: z.enum(['parent', 'after', 'related']),
  targetTaskId: z.string(),
  createdAt: z.string(),
  createdBy: z.enum(['cli', 'manual', 'import', 'agent']).optional(),
});

export const TaskRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  workflow: z.string(),
  status: z.enum(['active', 'completed', 'archived']),
  workflowMode: z.enum(['linear']),
  currentPhase: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paths: TaskPathsSchema,
  variables: z.record(z.string()),
  phaseHistory: z.array(PhaseHistoryEntrySchema),
  stateSync: TaskStateSyncSchema.optional(),
  rollback: TaskRollbackStateSchema.optional(),
  target: TaskTargetSchema.optional(),
  contextRefs: z.array(TaskContextRefSchema).optional(),
  links: z.array(TaskLinkSchema).optional(),
});

export const TaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['active', 'completed', 'archived']),
  currentPhase: z.string().nullable(),
  workflow: z.string(),
});

export const PromptContextModeSchema = z.enum(['compact', 'strict', 'full']);

export const OmittedPromptContextSchema = z.object({
  path: z.string(),
  role: z.string(),
  source: z.string(),
  reason: z.string(),
});

export const PromptArtifactMetadataSchema = z.object({
  promptArtifactPath: z.string(),
  contextMode: PromptContextModeSchema,
  generationSource: z.enum(['prompt', 'next', 'complete', 'mcp']),
  taskId: z.string(),
  phaseId: z.string().optional(),
  generatedAt: z.string(),
  omittedContext: z.array(OmittedPromptContextSchema),
});

export const PhaseDefinitionSchema = z.object({
  title: z.string(),
  template: z.string(),
  stepNumber: z.string().optional(),
  stepTitle: z.string().optional(),
  variables: z.record(VariableDeclarationSchema).optional(),
  requiredVariables: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  completion: PhaseCompletionSchema.optional(),
  gate: PhaseGateSchema.optional(),
  next: z.string().nullable().optional(),
  results: z.array(z.string()).min(1).optional(),
  nextByResult: z.record(z.string()).optional(),
  maxVisits: z.number().int().positive().optional(),
});

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.union([z.string(), z.number()]).optional(),
  mode: z.enum(['linear']),
  variables: z.record(VariableDeclarationSchema).optional(),
  artifacts: z.record(ArtifactDeclarationSchema).optional(),
  phaseOrder: z.array(z.string()),
  phases: z.record(PhaseDefinitionSchema),
});

export const SessionRecordSchema = z.object({
  sessionId: z.string(),
  adapter: z.string(),
  currentTaskId: z.string().nullable(),
});

export const HarnessAttemptResultSchema = z.enum(['success', 'failure']);

export const HarnessResetEventSchema = z.object({
  timestamp: z.string(),
  taskId: z.string(),
  previousBlocked: z.boolean(),
  previousCircuitBreaker: z.boolean(),
  reason: z.string().optional(),
  source: z.string(),
});

export const HarnessRecordSchema = z.object({
  taskId: z.string(),
  phaseId: z.string(),
  attemptCount: z.number().int().nonnegative(),
  retryBudget: z.number().int().positive(),
  lastResult: HarnessAttemptResultSchema.nullable(),
  lastFailureReason: z.string().nullable(),
  blocked: z.boolean(),
  circuitBreaker: z.boolean(),
  updatedAt: z.string(),
  resetEvents: z.array(HarnessResetEventSchema),
});
