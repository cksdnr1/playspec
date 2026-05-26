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
  eventType: z.string().optional(),
});

export const PhaseGateSchema = z.object({
  results: z.array(z.string()).min(1),
  nextByResult: z.record(z.string()),
  eventTypes: z.record(z.string()).optional(),
});

const FeedbackScoreThresholdSchema = z.number().min(0).max(100);

export const FeedbackScoreSourceSchema = z.object({
  artifactRole: z.string().min(1),
  preferredBlock: z.string().min(1).optional(),
  markdownFallback: z.boolean(),
});

export const FeedbackApprovalSchema = z.object({
  threshold: FeedbackScoreThresholdSchema,
  resultSource: z.enum(['completion_result']),
});

export const FeedbackCauseClassificationSchema = z.object({
  required: z.boolean(),
  allowed: z
    .array(
      z.enum([
        'artifact_quality_issue',
        'authoring_prompt_gap',
        'validation_prompt_gap',
        'workflow_policy_gap',
        'extractor_or_parser_error',
      ])
    )
    .min(1),
});

export const FeedbackTargetPromptSnapshotSchema = z.object({
  required: z.boolean(),
  hashAlgorithm: z.enum(['sha256']),
});

export const FeedbackDedupeSchema = z.object({
  enabled: z.boolean(),
  fields: z.array(z.string().min(1)).min(1),
});

export const FeedbackEvolutionSchema = z.object({
  mode: z.enum(['thread_only']),
  storageMode: z.enum(['thread_with_compact_history']),
  targetFiles: z.array(z.string().min(1)).min(1),
});

export const FeedbackPathKindSchema = z.enum([
  'workspace_relative',
  'workflow_relative',
  'user_home_relative',
  'package_relative',
]);

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
  minConfidence: z.enum(['low', 'medium', 'high']),
  requireHumanReviewBeforeProposal: z.boolean(),
});

export const PhaseFeedbackConfigSchema = z.object({
  enabled: z.boolean(),
  kind: z.enum(['prompt_evolution_signal']),
  feedbackThreshold: FeedbackScoreThresholdSchema,
  thresholdMode: z.enum(['greater_or_equal']),
  required: z.boolean(),
  onFailure: z.enum(['fail_completion', 'warn_and_continue', 'record_failure']),
  sourcePhaseId: z.string().min(1),
  evaluatedArtifactPhaseId: z.string().min(1),
  evolutionTargetPhaseId: z.string().min(1),
  scoreSource: FeedbackScoreSourceSchema,
  approval: FeedbackApprovalSchema,
  causeClassification: FeedbackCauseClassificationSchema,
  targetPromptSnapshot: FeedbackTargetPromptSnapshotSchema,
  dedupe: FeedbackDedupeSchema,
  evolution: FeedbackEvolutionSchema,
  workflowSource: FeedbackWorkflowSourceSchema,
  targetPromptTemplate: FeedbackTargetPromptTemplateSchema,
  compactHistoryPolicy: FeedbackCompactHistoryPolicySchema,
  proposalReadinessPolicy: FeedbackProposalReadinessPolicySchema,
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

export const CompletionFeedbackSuccessSchema = z.object({
  status: z.literal('captured'),
  threadId: z.string(),
  threadPath: z.string(),
  created: z.boolean(),
  approvalResult: z.string(),
  feedbackResult: z.string(),
  dedupeKeyHash: z.string(),
  score: z.number().min(0).max(100).optional(),
});

export const CompletionFeedbackFailureSchema = z.object({
  status: z.literal('failed'),
  policy: z.enum(['fail_completion', 'warn_and_continue', 'record_failure']),
  stage: z.enum(['missing_artifact', 'extraction', 'thread_update']),
  message: z.string(),
  feedbackResult: z.literal('parse_failed'),
});

export const CompletionFeedbackResultSchema = z.discriminatedUnion('status', [
  CompletionFeedbackSuccessSchema,
  CompletionFeedbackFailureSchema,
]);

export const CompletionEventSchema = z.object({
  id: z.string(),
  sequence: z.number().int().positive(),
  taskId: z.string(),
  phase: z.string(),
  phaseTitle: z.string(),
  completedAt: z.string(),
  type: z.string(),
  result: z.string().optional(),
  previousPhase: z.string().nullable(),
  nextPhase: z.string().nullable(),
  statusAfterCompletion: z.enum(['active', 'completed', 'archived']),
  gitHead: z.string().nullable(),
  evidenceFiles: z.array(z.string()),
  snapshotFiles: z.array(z.string()),
  reviewFile: z.string().optional(),
  rollbackSafePointId: z.string().optional(),
  feedback: CompletionFeedbackResultSchema.optional(),
  markdownFile: z.string(),
});

export const CompletionLedgerSchema = z.object({
  taskId: z.string(),
  events: z.array(CompletionEventSchema),
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
  eventTypes: z.record(z.string()).optional(),
  maxVisits: z.number().int().positive().optional(),
  feedback: PhaseFeedbackConfigSchema.optional(),
});

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.union([z.string(), z.number()]).optional(),
  builtinShadow: z.object({
    accepted: z.boolean().optional(),
  }).optional(),
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
