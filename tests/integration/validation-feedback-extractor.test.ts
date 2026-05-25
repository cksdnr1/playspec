import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import {
  ValidationFeedbackExtractionError,
  ValidationFeedbackExtractor,
} from '#evolution/validation-feedback-extractor.js';
import type { PhaseFeedbackConfig, ResolvedWorkflow, TaskRecord } from '#core/types.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function writeProjectWorkflow(): Promise<ResolvedWorkflow> {
  const rootDir = path.join(workspace.dir, '.playspec', 'workflows', 'mono-spec');
  const templateDir = path.join(rootDir, 'templates');
  await mkdir(templateDir, { recursive: true });
  await writeFile(path.join(templateDir, 'tech_spec_draft.md'), 'Draft {{FEATURE_SLUG}}', 'utf8');
  await writeFile(path.join(templateDir, 'tech_spec_validate.md'), 'Validate {{FEATURE_SLUG}}', 'utf8');

  return {
    id: 'mono-spec',
    rootDir,
    templateDir,
    source: 'project',
    definition: {
      id: 'mono-spec',
      mode: 'linear',
      version: '0.1.0',
      variables: {
        FEATURE_SLUG: {
          required: true,
        },
      },
      phaseOrder: ['tech_spec_draft', 'tech_spec_validate'],
      phases: {
        tech_spec_draft: {
          title: 'Tech spec draft',
          template: 'tech_spec_draft.md',
          requiredVariables: ['FEATURE_SLUG'],
        },
        tech_spec_validate: {
          title: 'Validate',
          template: 'tech_spec_validate.md',
        },
      },
    },
  };
}

function makeTask(): TaskRecord {
  return {
    id: 'issue_198',
    title: 'Issue 198',
    workflow: 'mono-spec',
    status: 'active',
    workflowMode: 'linear',
    currentPhase: 'tech_spec_validate',
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:00.000Z',
    paths: {
      taskRoot: '.playspec/tasks/active/issue_198',
      projectDocRoot: 'docs/features/issue_198',
    },
    variables: {
      FEATURE_SLUG: 'issue_198',
      artifactRole: 'spec',
    },
    phaseHistory: [],
  };
}

function makeConfig(overrides: Partial<PhaseFeedbackConfig> = {}): PhaseFeedbackConfig {
  return {
    enabled: true,
    kind: 'prompt_evolution_signal',
    feedbackThreshold: 80,
    thresholdMode: 'greater_or_equal',
    required: true,
    onFailure: 'record_failure',
    sourcePhaseId: 'tech_spec_validate',
    evaluatedArtifactPhaseId: 'tech_spec_draft',
    evolutionTargetPhaseId: 'tech_spec_draft',
    scoreSource: {
      artifactRole: 'spec',
      preferredBlock: 'playspecFeedback',
      markdownFallback: true,
    },
    approval: {
      threshold: 80,
      resultSource: 'completion_result',
    },
    causeClassification: {
      required: true,
      allowed: ['authoring_prompt_gap', 'validation_prompt_gap', 'extractor_or_parser_error'],
    },
    targetPromptSnapshot: {
      required: true,
      hashAlgorithm: 'sha256',
    },
    dedupe: {
      enabled: true,
      fields: ['artifactRole'],
    },
    evolution: {
      mode: 'thread_only',
      storageMode: 'thread_with_compact_history',
      targetFiles: ['templates/tech_spec_draft.md'],
    },
    workflowSource: {
      kind: 'project_local',
      root: '.playspec/workflows/mono-spec',
      rootPathKind: 'workspace_relative',
    },
    targetPromptTemplate: {
      path: 'tech_spec_draft.md',
      pathKind: 'workflow_relative',
      writable: true,
    },
    compactHistoryPolicy: {
      maxEntries: 5,
      keepFirst: true,
      keepLatest: 3,
      summarizeOverflow: true,
    },
    proposalReadinessPolicy: {
      mode: 'manual_only_initial',
      minRunCount: 3,
      minNegativeCount: 2,
      minConfidence: 'medium',
      requireHumanReviewBeforeProposal: true,
    },
    ...overrides,
  };
}

function structuredArtifact(score = 72): string {
  return `Review notes.

\`\`\`playspecFeedback
sourcePhaseId: tech_spec_validate
evaluatedArtifactPhaseId: tech_spec_draft
evolutionTargetPhaseId: tech_spec_draft
score: ${score}
approval:
  threshold: 80
  result: needs_revision
feedback:
  threshold: 80
  result: negative
cause:
  category: authoring_prompt_gap
  confidence: medium
  summary: Draft prompt needs clearer validation feedback guidance.
promptEvolution:
  targetType: workflow_prompt_template
  guidance: Require machine-readable feedback in validation prompts.
summary: Structured feedback extracted.
dedupeFieldValues:
  artifactRole: spec
\`\`\`
`;
}

describe('ValidationFeedbackExtractor', () => {
  it('extracts stable feedback metadata from playspecFeedback', async () => {
    const workflow = await writeProjectWorkflow();
    const result = new ValidationFeedbackExtractor(workspace.dir).extract({
      task: makeTask(),
      workflow,
      feedbackConfig: makeConfig(),
      phaseId: 'tech_spec_validate',
      artifactPath: '.playspec/tasks/active/issue_198/reviews/tech_spec_validate.md',
      artifactContent: structuredArtifact(),
      completionResult: 'needs_revision',
    });

    expect(result.method).toBe('machine_readable_block');
    expect(result.confidence).toBe('medium');
    expect(result.score).toBe(72);
    expect(result.approval).toEqual({ threshold: 80, result: 'needs_revision' });
    expect(result.feedback).toEqual({ threshold: 80, result: 'negative' });
    expect(result.causeClassification.selected).toBe('authoring_prompt_gap');
    expect(result.promptEvolution).toEqual({
      targetType: 'workflow_prompt_template',
      guidance: 'Require machine-readable feedback in validation prompts.',
    });
    expect(result.rawObservationRef).toBe('.playspec/tasks/active/issue_198/reviews/tech_spec_validate.md');
    expect(result.dedupeFieldValues).toEqual({ artifactRole: 'spec' });
  });

  it('rejects invalid structured scores like 190/100', async () => {
    const workflow = await writeProjectWorkflow();
    expect(() =>
      new ValidationFeedbackExtractor(workspace.dir).extract({
        task: makeTask(),
        workflow,
        feedbackConfig: makeConfig(),
        phaseId: 'tech_spec_validate',
        artifactContent: structuredArtifact(190),
      })
    ).toThrow(ValidationFeedbackExtractionError);
  });

  it('rejects required feedback when the machine-readable block is missing', async () => {
    const workflow = await writeProjectWorkflow();
    expect(() =>
      new ValidationFeedbackExtractor(workspace.dir).extract({
        task: makeTask(),
        workflow,
        feedbackConfig: makeConfig(),
        phaseId: 'tech_spec_validate',
        artifactContent: 'Score: 72/100',
      })
    ).toThrow(/missing a playspecFeedback block/);
  });

  it('preserves separate source, evaluated, and target phase IDs', async () => {
    const workflow = await writeProjectWorkflow();
    const result = new ValidationFeedbackExtractor(workspace.dir).extract({
      task: makeTask(),
      workflow,
      feedbackConfig: makeConfig(),
      phaseId: 'tech_spec_validate',
      artifactContent: structuredArtifact(),
    });

    expect(result.sourcePhaseId).toBe('tech_spec_validate');
    expect(result.evaluatedArtifactPhaseId).toBe('tech_spec_draft');
    expect(result.evolutionTargetPhaseId).toBe('tech_spec_draft');
  });

  it('resolves target type, workflow source metadata, and target writability from config', async () => {
    const workflow = await writeProjectWorkflow();
    const result = new ValidationFeedbackExtractor(workspace.dir).extract({
      task: makeTask(),
      workflow,
      feedbackConfig: makeConfig(),
      phaseId: 'tech_spec_validate',
      artifactContent: structuredArtifact(),
    });

    expect(result.promptEvolution.targetType).toBe('workflow_prompt_template');
    expect(result.workflowSource.kind).toBe('project_local');
    expect(result.workflowSource.root).toBe('.playspec/workflows/mono-spec');
    expect(result.targetPromptTemplate).toEqual({
      path: 'templates/tech_spec_draft.md',
      pathKind: 'workflow_relative',
      writable: true,
    });
    expect(result.targetWritable).toBe(true);
    expect(result.targetPath).toBe('.playspec/workflows/mono-spec/templates/tech_spec_draft.md');
  });

  it('records low confidence for optional markdown fallback extraction', async () => {
    const workflow = await writeProjectWorkflow();
    const result = new ValidationFeedbackExtractor(workspace.dir).extract({
      task: makeTask(),
      workflow,
      feedbackConfig: makeConfig({ required: false }),
      phaseId: 'tech_spec_validate',
      artifactContent: 'Validation review\n\nScore: 91/100\n',
    });

    expect(result.method).toBe('markdown_fallback');
    expect(result.confidence).toBe('low');
    expect(result.score).toBe(91);
    expect(result.feedback.result).toBe('positive');
    expect(result.causeClassification).toMatchObject({
      selected: 'extractor_or_parser_error',
      confidence: 'low',
    });
  });

  it('rejects invalid markdown fallback scores like 190/100', async () => {
    const workflow = await writeProjectWorkflow();
    expect(() =>
      new ValidationFeedbackExtractor(workspace.dir).extract({
        task: makeTask(),
        workflow,
        feedbackConfig: makeConfig({ required: false }),
        phaseId: 'tech_spec_validate',
        artifactContent: 'Score: 190/100',
      })
    ).toThrow(/Invalid validation feedback score/);
  });
});
