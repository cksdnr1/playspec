import YAML from 'yaml';
import { z } from 'zod';
import { FeedbackWorkflowSourceResolver } from './feedback-workflow-source-resolver.js';
import {
  ValidationFeedbackBlockSchema,
  ValidationFeedbackExtractionSchema,
} from './schemas.js';
import type { PhaseFeedbackConfig } from '#core/types.js';
import type {
  FeedbackApprovalResult,
  FeedbackCauseCategory,
  FeedbackSignalResult,
  ValidationFeedbackExtraction,
  ValidationFeedbackExtractionInput,
} from './types.js';

export class ValidationFeedbackExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationFeedbackExtractionError';
  }
}

export class ValidationFeedbackExtractor {
  private readonly sourceResolver: FeedbackWorkflowSourceResolver;

  constructor(private readonly workspaceRoot: string) {
    this.sourceResolver = new FeedbackWorkflowSourceResolver(workspaceRoot);
  }

  extract(input: ValidationFeedbackExtractionInput): ValidationFeedbackExtraction {
    const block = this.extractMachineReadableBlock(input.artifactContent);
    if (block) {
      return this.extractFromBlock(input, block);
    }

    if (input.feedbackConfig.required) {
      throw new ValidationFeedbackExtractionError(
        `Required validation feedback for phase "${input.phaseId}" is missing a playspecFeedback block.`
      );
    }

    if (!input.feedbackConfig.scoreSource.markdownFallback) {
      throw new ValidationFeedbackExtractionError(
        `Validation feedback for phase "${input.phaseId}" is not required, but markdown fallback is disabled.`
      );
    }

    return this.extractFromMarkdownFallback(input);
  }

  private extractFromBlock(input: ValidationFeedbackExtractionInput, rawBlock: unknown): ValidationFeedbackExtraction {
    const parsed = parseSchema(ValidationFeedbackBlockSchema, rawBlock, 'Invalid playspecFeedback block');
    assertConfiguredPhase('sourcePhaseId', parsed.sourcePhaseId, input.feedbackConfig.sourcePhaseId);
    assertConfiguredPhase(
      'evaluatedArtifactPhaseId',
      parsed.evaluatedArtifactPhaseId,
      input.feedbackConfig.evaluatedArtifactPhaseId
    );
    const evolutionTargetPhaseId = resolveEvolutionTargetPhaseId(input, parsed);

    const resolution = this.sourceResolver.resolve(input.workflow, input.feedbackConfig);
    const feedbackThreshold = parsed.feedback?.threshold ?? input.feedbackConfig.feedbackThreshold;
    const approvalThreshold = parsed.approval?.threshold ?? input.feedbackConfig.approval.threshold;
    const feedbackResult = parsed.feedback?.result ?? feedbackResultFromScore(parsed.score, feedbackThreshold);
    const approvalResult = parsed.approval?.result ?? approvalResultFromInput(input, parsed.score, approvalThreshold);

    return parseSchema(
      ValidationFeedbackExtractionSchema,
      {
        method: 'machine_readable_block',
        confidence: parsed.cause.confidence,
        sourcePhaseId: parsed.sourcePhaseId ?? input.feedbackConfig.sourcePhaseId,
        evaluatedArtifactPhaseId: parsed.evaluatedArtifactPhaseId ?? input.feedbackConfig.evaluatedArtifactPhaseId,
        evolutionTargetPhaseId,
        score: parsed.score,
        approval: {
          threshold: approvalThreshold,
          result: approvalResult,
        },
        feedback: {
          threshold: feedbackThreshold,
          result: feedbackResult,
        },
        causeClassification: {
          selected: parsed.cause.category,
          confidence: parsed.cause.confidence,
          ...(parsed.cause.summary ? { summary: parsed.cause.summary } : {}),
        },
        promptEvolution: {
          targetType: parsed.promptEvolution?.targetType ?? 'workflow_prompt_template',
          ...(parsed.promptEvolution?.guidance ? { guidance: parsed.promptEvolution.guidance } : {}),
        },
        workflowSource: parsed.workflowSource ?? resolution.workflowSource,
        targetPromptTemplate: parsed.target ?? resolution.targetPromptTemplate,
        targetWritable: parsed.targetWritable ?? parsed.target?.writable ?? resolution.targetWritable,
        targetPath: parsed.targetPath ?? resolution.targetPath,
        summary: parsed.summary ?? defaultSummary(feedbackResult, parsed.score),
        ...(input.artifactPath ? { rawObservationRef: input.artifactPath } : {}),
        ...(parsed.dedupeFieldValues ? { dedupeFieldValues: parsed.dedupeFieldValues } : {}),
      },
      'Invalid validation feedback extraction'
    );
  }

  private extractFromMarkdownFallback(input: ValidationFeedbackExtractionInput): ValidationFeedbackExtraction {
    const match = input.artifactContent.match(/(?:^|\n)\s*Score:\s*(\d+(?:\.\d+)?)\s*\/\s*100\b/i);
    if (!match) {
      throw new ValidationFeedbackExtractionError(
        `Could not extract fallback validation score for phase "${input.phaseId}".`
      );
    }

    const score = Number(match[1]);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new ValidationFeedbackExtractionError(`Invalid validation feedback score "${match[1]}/100".`);
    }

    const resolution = this.sourceResolver.resolve(input.workflow, input.feedbackConfig);
    const feedbackResult = feedbackResultFromScore(score, input.feedbackConfig.feedbackThreshold);
    const approvalResult = approvalResultFromInput(input, score, input.feedbackConfig.approval.threshold);

    return parseSchema(
      ValidationFeedbackExtractionSchema,
      {
        method: 'markdown_fallback',
        confidence: 'low',
        sourcePhaseId: input.feedbackConfig.sourcePhaseId,
        evaluatedArtifactPhaseId: input.feedbackConfig.evaluatedArtifactPhaseId,
        evolutionTargetPhaseId: input.feedbackConfig.evolutionTargetPhaseId,
        score,
        approval: {
          threshold: input.feedbackConfig.approval.threshold,
          result: approvalResult,
        },
        feedback: {
          threshold: input.feedbackConfig.feedbackThreshold,
          result: feedbackResult,
        },
        causeClassification: {
          selected: 'extractor_or_parser_error',
          confidence: 'low',
          summary: 'Low-confidence markdown fallback extraction.',
        },
        promptEvolution: {
          targetType: 'workflow_prompt_template',
        },
        workflowSource: resolution.workflowSource,
        targetPromptTemplate: resolution.targetPromptTemplate,
        targetWritable: resolution.targetWritable,
        targetPath: resolution.targetPath,
        summary: defaultSummary(feedbackResult, score),
        ...(input.artifactPath ? { rawObservationRef: input.artifactPath } : {}),
      },
      'Invalid fallback validation feedback extraction'
    );
  }

  private extractMachineReadableBlock(content: string): unknown | undefined {
    for (const fence of fencedBlocks(content)) {
      if (fence.info.includes('playspecfeedback')) {
        return parseBlockPayload(fence.body);
      }

      if (fence.info.includes('yaml') || fence.info.includes('yml') || fence.info.includes('json')) {
        const parsed = parseBlockPayload(fence.body);
        const nested = unwrapPlayspecFeedback(parsed);
        if (nested !== undefined) {
          return nested;
        }
      }
    }

    return undefined;
  }
}

function parseSchema<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationFeedbackExtractionError(`${message}: ${error.issues.map((issue) => issue.message).join('; ')}`);
    }
    throw error;
  }
}

function parseBlockPayload(body: string): unknown {
  try {
    const parsed = YAML.parse(body);
    return unwrapPlayspecFeedback(parsed) ?? parsed;
  } catch (error) {
    throw new ValidationFeedbackExtractionError(
      `Could not parse playspecFeedback block: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function unwrapPlayspecFeedback(parsed: unknown): unknown | undefined {
  if (parsed && typeof parsed === 'object' && 'playspecFeedback' in parsed) {
    return (parsed as { playspecFeedback?: unknown }).playspecFeedback;
  }
  return undefined;
}

function* fencedBlocks(content: string): Generator<{ info: string; body: string }> {
  const blockPattern = /^```([^\n`]*)\n([\s\S]*?)^```/gm;
  for (const match of content.matchAll(blockPattern)) {
    yield {
      info: (match[1] ?? '').trim().toLowerCase(),
      body: match[2] ?? '',
    };
  }
}

function assertConfiguredPhase(
  field: 'sourcePhaseId' | 'evaluatedArtifactPhaseId' | 'evolutionTargetPhaseId',
  observed: string | undefined,
  configured: string
): void {
  if (observed !== undefined && observed !== configured) {
    throw new ValidationFeedbackExtractionError(
      `playspecFeedback.${field} "${observed}" does not match configured phase "${configured}".`
    );
  }
}

function resolveEvolutionTargetPhaseId(
  input: ValidationFeedbackExtractionInput,
  parsed: {
    evolutionTargetPhaseId?: string;
    cause: { category: FeedbackCauseCategory };
  }
): string {
  const observed = parsed.evolutionTargetPhaseId;
  const configured = input.feedbackConfig.evolutionTargetPhaseId;
  if (observed === undefined || observed === configured) {
    return observed ?? configured;
  }

  if (parsed.cause.category === 'validation_prompt_gap' && observed === input.phaseId) {
    if (!input.workflow.definition.phases[observed]) {
      throw new ValidationFeedbackExtractionError(
        `playspecFeedback.evolutionTargetPhaseId "${observed}" does not reference a workflow phase.`
      );
    }
    return observed;
  }

  throw new ValidationFeedbackExtractionError(
    `playspecFeedback.evolutionTargetPhaseId "${observed}" does not match configured phase "${configured}".`
  );
}

function feedbackResultFromScore(score: number, threshold: number): FeedbackSignalResult {
  return score >= threshold ? 'positive' : 'negative';
}

function approvalResultFromInput(
  input: ValidationFeedbackExtractionInput,
  score: number,
  threshold: number
): FeedbackApprovalResult {
  if (input.completionResult) {
    return input.completionResult;
  }
  return score >= threshold ? 'approved' : 'needs_revision';
}

function defaultSummary(result: FeedbackSignalResult, score: number): string {
  return `Validation feedback ${result} at score ${score}/100.`;
}
