import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import {
  FeedbackRawObservationEventSchema,
  FeedbackThreadSchema,
} from '#evolution/schemas.js';
import { EvolutionFeedbackThreadStore } from '#evolution/feedback-thread-store.js';
import type {
  FeedbackRawObservationEvent,
  FeedbackThread,
} from '#evolution/types.js';
import {
  getEvolutionFeedbackObservationPath,
  getEvolutionFeedbackObservationsRoot,
  getEvolutionFeedbackThreadPath,
  getEvolutionFeedbackThreadsRoot,
} from '#utils/paths.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

function makeThread(overrides: Partial<FeedbackThread> = {}): FeedbackThread {
  return {
    id: 'feedback_thread_20260525_001',
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:00.000Z',
    sourcePhaseId: 'tech_spec_validate',
    evaluatedArtifactPhaseId: 'tech_spec_draft',
    evolutionTargetPhaseId: 'tech_spec_draft',
    workflowSource: {
      kind: 'project_local',
      root: '.playspec/workflows/mono-spec',
      rootPathKind: 'workspace_relative',
    },
    targetPromptTemplate: {
      path: 'templates/tech_spec_draft.md',
      pathKind: 'workflow_relative',
      writable: true,
    },
    targetWritable: true,
    targetPath: '.playspec/workflows/mono-spec/templates/tech_spec_draft.md',
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
    mutationStrategy: 'manual_review_only',
    trend: {
      totalEvents: 1,
      positiveCount: 0,
      negativeCount: 1,
      neutralCount: 0,
      parseFailureCount: 0,
      direction: 'declining',
      confidence: 'medium',
      readinessState: 'not_ready',
      lastEventAt: '2026-05-25T00:01:00.000Z',
    },
    events: [
      {
        eventId: 'event_001',
        taskId: 'github_issue_196',
        phaseId: 'tech_spec_validate',
        createdAt: '2026-05-25T00:01:00.000Z',
        approvalResult: 'needs_revision',
        feedbackResult: 'negative',
        score: 72,
        causeClassification: {
          selected: 'authoring_prompt_gap',
          confidence: 'medium',
          summary: 'The validation found missing storage detail.',
        },
        summary: 'Spec needs clearer persistence behavior.',
      },
    ],
    ...overrides,
  };
}

function makeRawObservation(overrides: Partial<FeedbackRawObservationEvent> = {}): FeedbackRawObservationEvent {
  return {
    id: 'raw_observation_001',
    threadId: 'feedback_thread_20260525_001',
    taskId: 'github_issue_196',
    phaseId: 'tech_spec_validate',
    createdAt: '2026-05-25T00:02:03.000Z',
    approvalResult: 'needs_revision',
    feedbackResult: 'negative',
    score: 72,
    causeClassification: {
      selected: 'authoring_prompt_gap',
      confidence: 'medium',
      summary: 'The validation found missing storage detail.',
    },
    summary: 'Raw validation result captured for audit.',
    raw: {
      markdownBlock: 'playspecFeedback',
      originalResult: 'needs_revision',
    },
    ...overrides,
  };
}

describe('FeedbackThreadSchema', () => {
  it('preserves approval and feedback results as separate event fields', () => {
    const parsed = FeedbackThreadSchema.parse(makeThread()) as FeedbackThread;

    expect(parsed.events[0]?.approvalResult).toBe('needs_revision');
    expect(parsed.events[0]?.feedbackResult).toBe('negative');
  });

  it('rejects invalid thread IDs and raw observation path segments', () => {
    expect(() => FeedbackThreadSchema.parse(makeThread({ id: '../bad' }))).toThrow();
    expect(() => FeedbackRawObservationEventSchema.parse(makeRawObservation({ taskId: '../bad' }))).toThrow();
    expect(() => FeedbackRawObservationEventSchema.parse(makeRawObservation({ phaseId: '/bad' }))).toThrow();
  });
});

describe('EvolutionFeedbackThreadStore', () => {
  it('persists, reloads, and lists valid feedback threads', async () => {
    const store = new EvolutionFeedbackThreadStore(workspace.dir);
    const thread = makeThread();

    const threadPath = await store.saveThread(thread);
    const loaded = await store.loadThread(thread.id);
    const listed = await store.listThreads();

    expect(threadPath).toBe(getEvolutionFeedbackThreadPath(workspace.dir, thread.id));
    expect(path.resolve(threadPath).startsWith(path.resolve(workspace.dir, '.playspec', 'evolution', 'feedback'))).toBe(true);
    expect(loaded).toEqual(thread);
    expect(listed).toEqual([thread]);
  });

  it('updates an existing thread by ID without creating another thread file', async () => {
    const store = new EvolutionFeedbackThreadStore(workspace.dir);
    const thread = makeThread();
    await store.saveThread(thread);

    const updated = makeThread({
      updatedAt: '2026-05-25T00:03:00.000Z',
      trend: {
        ...thread.trend,
        totalEvents: 2,
        negativeCount: 2,
        readinessState: 'ready_for_review',
      },
      events: [
        ...thread.events,
        {
          eventId: 'event_002',
          taskId: 'github_issue_196',
          phaseId: 'tech_spec_validate',
          createdAt: '2026-05-25T00:03:00.000Z',
          approvalResult: 'approved',
          feedbackResult: 'neutral',
          causeClassification: {
            selected: 'validation_prompt_gap',
            confidence: 'low',
          },
          summary: 'Validation passed but noted prompt tuning opportunity.',
        },
      ],
    });

    const updatedPath = await store.upsertThread(updated);
    const threadFiles = await readdir(getEvolutionFeedbackThreadsRoot(workspace.dir));
    const loaded = await store.loadThread(thread.id);

    expect(updatedPath).toBe(getEvolutionFeedbackThreadPath(workspace.dir, thread.id));
    expect(threadFiles).toEqual([`${thread.id}.yaml`]);
    expect(loaded.updatedAt).toBe('2026-05-25T00:03:00.000Z');
    expect(loaded.trend.readinessState).toBe('ready_for_review');
    expect(loaded.events).toHaveLength(2);
  });

  it('preserves classification, trend, readiness policy, source metadata, writability, and mutation strategy', async () => {
    const store = new EvolutionFeedbackThreadStore(workspace.dir);
    const thread = makeThread({
      workflowSource: {
        kind: 'bundled_preset',
        root: 'src/preset/assets/workflows/mono-spec',
        rootPathKind: 'package_relative',
        presetId: 'default',
        version: '0.1.0',
      },
      targetPromptTemplate: {
        path: '.playspec/workflows/mono-spec/templates/tech_spec_draft.md',
        pathKind: 'workspace_relative',
        writable: false,
      },
      targetWritable: false,
    });

    await store.saveThread(thread);
    const loaded = await store.loadThread(thread.id);

    expect(loaded.events[0]?.causeClassification.selected).toBe('authoring_prompt_gap');
    expect(loaded.trend.direction).toBe('declining');
    expect(loaded.proposalReadinessPolicy.requireHumanReviewBeforeProposal).toBe(true);
    expect(loaded.workflowSource.kind).toBe('bundled_preset');
    expect(loaded.workflowSource.rootPathKind).toBe('package_relative');
    expect(loaded.targetPromptTemplate.pathKind).toBe('workspace_relative');
    expect(loaded.targetPromptTemplate.writable).toBe(false);
    expect(loaded.targetWritable).toBe(false);
    expect(loaded.mutationStrategy).toBe('manual_review_only');
  });

  it('does not create raw observation files when saving or upserting canonical threads', async () => {
    const store = new EvolutionFeedbackThreadStore(workspace.dir);
    const thread = makeThread();

    await store.saveThread(thread);
    await store.upsertThread({ ...thread, updatedAt: '2026-05-25T00:04:00.000Z' });

    await expect(access(getEvolutionFeedbackObservationsRoot(workspace.dir))).rejects.toThrow();
  });

  it('writes raw observations only through the explicit raw observation API', async () => {
    const store = new EvolutionFeedbackThreadStore(workspace.dir);
    const observation = makeRawObservation();

    const observationPath = await store.saveRawObservation(observation);
    const expectedPath = getEvolutionFeedbackObservationPath(
      workspace.dir,
      observation.taskId,
      observation.phaseId,
      '20260525t000203z'
    );

    expect(observationPath).toBe(expectedPath);
    await expect(access(observationPath)).resolves.toBeUndefined();
  });
});
