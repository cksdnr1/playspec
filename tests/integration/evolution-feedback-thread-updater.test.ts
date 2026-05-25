import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { FeedbackThreadUpdater } from '#evolution/feedback-thread-updater.js';
import { EvolutionFeedbackThreadStore } from '#evolution/feedback-thread-store.js';
import type { PhaseFeedbackConfig, ResolvedWorkflow, TaskRecord } from '#core/types.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function writeProjectWorkflow(templateContent: string): Promise<ResolvedWorkflow> {
  const rootDir = path.join(workspace.dir, '.playspec', 'workflows', 'mono-spec');
  const templateDir = path.join(rootDir, 'templates');
  await mkdir(templateDir, { recursive: true });
  await writeFile(path.join(templateDir, 'tech_spec_draft.md'), templateContent, 'utf8');

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
        SHARED: {
          default: 'shared-default',
        },
      },
      phaseOrder: ['tech_spec_draft', 'tech_spec_validate'],
      phases: {
        tech_spec_draft: {
          title: 'Tech spec draft',
          template: 'tech_spec_draft.md',
          variables: {
            LOCAL: {
              default: 'local-default',
            },
          },
        },
        tech_spec_validate: {
          title: 'Validate',
          template: 'tech_spec_draft.md',
        },
      },
    },
  };
}

function makeTask(): TaskRecord {
  return {
    id: 'github_issue_197',
    title: 'GitHub issue #197',
    workflow: 'mono-spec',
    status: 'active',
    workflowMode: 'linear',
    currentPhase: 'tech_spec_validate',
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:00.000Z',
    paths: {
      taskRoot: '.playspec/tasks/active/github_issue_197',
      projectDocRoot: 'docs/features/github_issue_197',
    },
    variables: {
      FEATURE_SLUG: 'github_issue_197',
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
      markdownFallback: true,
    },
    approval: {
      threshold: 80,
      resultSource: 'completion_result',
    },
    causeClassification: {
      required: true,
      allowed: ['authoring_prompt_gap', 'validation_prompt_gap'],
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
      maxEntries: 3,
      keepFirst: true,
      keepLatest: 2,
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

describe('FeedbackThreadUpdater', () => {
  it('updates one thread for repeated semantic signals and records changed prompt hashes', async () => {
    const workflow = await writeProjectWorkflow('Draft {{FEATURE_SLUG}} {{LOCAL}}');
    const updater = new FeedbackThreadUpdater(workspace.dir);
    const baseInput = {
      task: makeTask(),
      workflow,
      feedbackConfig: makeConfig(),
      phaseId: 'tech_spec_validate',
      approvalResult: 'needs_revision' as const,
      feedbackResult: 'negative' as const,
      causeClassification: {
        selected: 'authoring_prompt_gap' as const,
        confidence: 'medium' as const,
      },
      summary: 'Spec needs clearer prompt guidance.',
      createdAt: '2026-05-25T00:00:01.000Z',
    };

    const first = await updater.update(baseInput);
    await writeFile(path.join(workflow.templateDir, 'tech_spec_draft.md'), 'Draft {{FEATURE_SLUG}} changed', 'utf8');
    const second = await updater.update({
      ...baseInput,
      createdAt: '2026-05-25T00:00:02.000Z',
      summary: 'Same semantic issue after prompt edit.',
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.thread.id).toBe(first.thread.id);
    expect(second.thread.events).toHaveLength(2);
    expect(second.thread.events[0]?.promptSnapshot.hash).not.toBe(second.thread.events[1]?.promptSnapshot.hash);
    expect(second.thread.dedupeKeyHash).toBe(first.thread.dedupeKeyHash);
  });

  it('compacts history while preserving first/latest evidence and mixed trend counts', async () => {
    const workflow = await writeProjectWorkflow('Draft {{FEATURE_SLUG}}');
    const updater = new FeedbackThreadUpdater(workspace.dir);
    const task = makeTask();
    const feedbackConfig = makeConfig();

    const results = ['negative', 'positive', 'negative', 'neutral', 'parse_failed'] as const;
    for (const [index, feedbackResult] of results.entries()) {
      await updater.update({
        task,
        workflow,
        feedbackConfig,
        phaseId: 'tech_spec_validate',
        approvalResult: feedbackResult === 'positive' ? 'approved' : 'needs_revision',
        feedbackResult,
        causeClassification: {
          selected: 'authoring_prompt_gap',
          confidence: 'medium',
        },
        summary: `Signal ${index}`,
        createdAt: `2026-05-25T00:00:0${index + 1}.000Z`,
      });
    }

    const [thread] = await new EvolutionFeedbackThreadStore(workspace.dir).listThreads();

    expect(thread?.events).toHaveLength(3);
    expect(thread?.events[0]?.summary).toBe('Signal 0');
    expect(thread?.events[1]?.summary).toBe('Signal 3');
    expect(thread?.events[2]?.summary).toBe('Signal 4');
    expect(thread?.historyOverflowSummary?.omittedEventCount).toBe(2);
    expect(thread?.trend.totalEvents).toBe(5);
    expect(thread?.trend.positiveCount).toBe(1);
    expect(thread?.trend.negativeCount).toBe(2);
    expect(thread?.trend.neutralCount).toBe(1);
    expect(thread?.trend.parseFailureCount).toBe(1);
    expect(thread?.trend.readinessState).toBe('ready_for_review');
    expect(thread?.trend.readinessState).not.toBe('proposal_candidate');
  });

  it('keeps prompt hashes out of semantic dedupe keys', async () => {
    const workflow = await writeProjectWorkflow('Draft {{FEATURE_SLUG}}');
    const updater = new FeedbackThreadUpdater(workspace.dir);
    const input = {
      task: makeTask(),
      workflow,
      feedbackConfig: makeConfig(),
      phaseId: 'tech_spec_validate',
      approvalResult: 'needs_revision' as const,
      feedbackResult: 'negative' as const,
      causeClassification: {
        selected: 'authoring_prompt_gap' as const,
        confidence: 'medium' as const,
      },
      summary: 'Spec needs clearer prompt guidance.',
      createdAt: '2026-05-25T00:00:01.000Z',
    };

    const first = await updater.update(input);
    await writeFile(path.join(workflow.templateDir, 'tech_spec_draft.md'), 'Different prompt body', 'utf8');
    const second = await updater.update({ ...input, createdAt: '2026-05-25T00:00:02.000Z' });

    expect(first.thread.dedupeKey).toEqual(second.thread.dedupeKey);
    expect(JSON.stringify(second.thread.dedupeKey)).not.toContain(second.thread.events[1]?.promptSnapshot.hash);
  });
});
