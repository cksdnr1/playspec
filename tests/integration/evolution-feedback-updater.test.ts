import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { appendFeedbackThreadEvidence } from '#evolution/feedback-updater.js';
import { EvolutionFeedbackThreadStore } from '#evolution/feedback-thread-store.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import type { EvolutionProposal, FeedbackThread } from '#evolution/types.js';
import { getEvolutionProposalRevisionPath } from '#utils/paths.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

function makeProposal(id: string, status: EvolutionProposal['status'] = 'pending'): EvolutionProposal {
  return {
    id,
    revision: 1,
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:00.000Z',
    status,
    source: {
      artifactRefs: [],
    },
    targetFiles: ['docs/features/source_task/spec.md'],
    evidenceRefs: [],
    riskLevel: 'low',
    actions: [
      {
        actionId: 'action_1',
        type: 'propose_file_change',
        targetPath: 'docs/features/source_task/spec.md',
        summary: 'Update spec wording.',
        rationale: 'The current spec is stale.',
      },
    ],
    rationale: 'Keep the spec aligned with implementation.',
    review: {
      status: 'unreviewed',
    },
  };
}

function makeThread(overrides: Partial<FeedbackThread> = {}): FeedbackThread {
  const base: FeedbackThread = {
    id: 'feedback_thread_1',
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:03.000Z',
    dedupeKey: {
      version: 1,
      workflowId: 'mono-spec',
      feedbackKind: 'prompt_evolution_signal',
      sourcePhaseId: 'tech_spec_validate',
      evaluatedArtifactPhaseId: 'tech_spec_draft',
      evolutionTargetPhaseId: 'tech_spec_draft',
      causeCategory: 'authoring_prompt_gap',
      fields: {
        artifactRole: 'spec',
      },
    },
    dedupeKeyHash: 'a'.repeat(64),
    sourcePhaseId: 'tech_spec_validate',
    evaluatedArtifactPhaseId: 'tech_spec_draft',
    evolutionTargetPhaseId: 'tech_spec_draft',
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
    targetWritable: true,
    targetPath: '.playspec/workflows/mono-spec/templates/tech_spec_draft.md',
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
    mutationStrategy: 'manual_review_only',
    trend: {
      totalEvents: 3,
      positiveCount: 0,
      negativeCount: 3,
      neutralCount: 0,
      parseFailureCount: 0,
      direction: 'declining',
      confidence: 'medium',
      readinessState: 'ready_for_review',
      lastEventAt: '2026-05-25T00:00:03.000Z',
    },
    events: [
      makeEvent('event_1', 'First validation summary.'),
      makeEvent('event_2', 'Second validation summary.'),
      makeEvent('event_3', 'Third validation summary.'),
    ],
  };

  return {
    ...base,
    ...overrides,
  };
}

function makeEvent(eventId: string, summary: string): FeedbackThread['events'][number] {
  return {
    eventId,
    taskId: 'task_1',
    phaseId: 'tech_spec_validate',
    createdAt: '2026-05-25T00:00:00.000Z',
    approvalResult: 'needs_revision',
    feedbackResult: 'negative',
    score: 72,
    causeClassification: {
      selected: 'authoring_prompt_gap',
      confidence: 'medium',
    },
    summary,
    promptSnapshot: {
      algorithm: 'sha256',
      hash: 'b'.repeat(64),
      renderedByteLength: 120,
      targetPhaseId: 'tech_spec_draft',
      templatePath: 'tech_spec_draft.md',
      templatePathKind: 'workflow_relative',
      createdAt: '2026-05-25T00:00:00.000Z',
    },
  };
}

async function saveProposalAndThread(
  proposalId = 'proposal_feedback',
  thread: FeedbackThread = makeThread()
): Promise<void> {
  await new EvolutionProposalStore(workspace.dir).saveProposal(makeProposal(proposalId));
  await new EvolutionFeedbackThreadStore(workspace.dir).saveThread(thread);
}

describe('appendFeedbackThreadEvidence', () => {
  it('appends compact feedback thread evidence to an explicit pending proposal', async () => {
    await saveProposalAndThread();

    const result = await appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'proposal_feedback',
      threadId: 'feedback_thread_1',
    });
    const loaded = await new EvolutionProposalStore(workspace.dir).loadProposal('proposal_feedback');

    expect(result.proposal.revision).toBe(2);
    expect(result.evidencePath).toBe('.playspec/evolution/feedback/threads/feedback_thread_1.yaml');
    expect(result.evidenceNote).toContain('Feedback thread feedback_thread_1 for tech_spec_validate -> tech_spec_draft.');
    expect(result.evidenceNote).toContain('Trend: declining, readiness: ready_for_review, total events: 3');
    expect(result.evidenceNote).toContain('Latest summaries: First validation summary. | Second validation summary. | Third validation summary.');
    expect(result.evidenceNote).toContain('Target strategy: mutate project-local/user-global proposal target only after review.');
    expect(loaded.evidenceRefs).toEqual([
      expect.objectContaining({
        path: '.playspec/evolution/feedback/threads/feedback_thread_1.yaml',
        source: 'append-evidence',
      }),
    ]);
    await expect(access(getEvolutionProposalRevisionPath(workspace.dir, 'proposal_feedback', 1))).resolves.toBeUndefined();
  });

  it('appends feedback thread evidence to an explicit refining proposal', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    await store.saveProposal(makeProposal('proposal_refining'));
    await store.updateProposal('proposal_refining', {
      ...makeProposal('proposal_refining', 'refining'),
      revision: 1,
      createdAt: '2026-05-25T00:00:00.000Z',
      updatedAt: '2026-05-25T00:00:01.000Z',
    });
    await new EvolutionFeedbackThreadStore(workspace.dir).saveThread(makeThread());

    const result = await appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'proposal_refining',
      threadId: 'feedback_thread_1',
    });

    expect(result.proposal.status).toBe('refining');
    expect(result.proposal.revision).toBe(3);
    expect(result.proposal.evidenceRefs).toHaveLength(1);
  });

  it('uses read-only target guidance and overflow summaries without raw event expansion', async () => {
    await saveProposalAndThread('proposal_feedback', makeThread({
      workflowSource: {
        kind: 'bundled_preset',
        root: 'src/preset/assets/workflows/mono-spec',
        rootPathKind: 'package_relative',
        packageName: 'playspec',
        presetId: 'default',
      },
      targetWritable: false,
      historyOverflowSummary: {
        omittedEventCount: 2,
        positiveCount: 0,
        negativeCount: 2,
        neutralCount: 0,
        parseFailureCount: 0,
        firstOmittedAt: '2026-05-25T00:00:01.000Z',
        lastOmittedAt: '2026-05-25T00:00:02.000Z',
      },
    }));

    const result = await appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'proposal_feedback',
      threadId: 'feedback_thread_1',
    });

    expect(result.evidenceNote).toContain('History overflow: 2 omitted event(s)');
    expect(result.evidenceNote).toContain('do not mutate bundled/external/read-only targets directly');
  });

  it('rejects terminal skipped proposals before writing a revision', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    await saveProposalAndThread('proposal_terminal');
    await store.skipProposal('proposal_terminal');

    await expect(appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'proposal_terminal',
      threadId: 'feedback_thread_1',
    })).rejects.toThrow('Only pending/refining proposals can be changed');
    await expect(access(getEvolutionProposalRevisionPath(workspace.dir, 'proposal_terminal', 1))).rejects.toThrow();
  });

  it('rejects terminal applied and failed proposals before writing a revision', async () => {
    for (const status of ['applied', 'failed'] as const) {
      const store = new EvolutionProposalStore(workspace.dir);
      const proposalId = `proposal_${status}`;
      const threadId = `feedback_thread_${status}`;
      await store.saveProposal(makeProposal(proposalId));
      await store.markProposalApplyStatus(proposalId, status, `.playspec/evolution/reports/${proposalId}.yaml`);
      await new EvolutionFeedbackThreadStore(workspace.dir).saveThread(makeThread({ id: threadId }));

      await expect(appendFeedbackThreadEvidence(workspace.dir, {
        proposalId,
        threadId,
      })).rejects.toThrow('Only pending/refining proposals can be changed');
      await expect(access(getEvolutionProposalRevisionPath(workspace.dir, proposalId, 1))).rejects.toThrow();
    }
  });

  it('rejects missing proposals before writing thread-derived evidence elsewhere', async () => {
    await new EvolutionFeedbackThreadStore(workspace.dir).saveThread(makeThread());

    await expect(appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'missing_proposal',
      threadId: 'feedback_thread_1',
    })).rejects.toThrow();
  });

  it('rejects missing threads before mutating the explicit proposal', async () => {
    await new EvolutionProposalStore(workspace.dir).saveProposal(makeProposal('proposal_feedback'));

    await expect(appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'proposal_feedback',
      threadId: 'missing_thread',
    })).rejects.toThrow();
    await expect(access(getEvolutionProposalRevisionPath(workspace.dir, 'proposal_feedback', 1))).rejects.toThrow();
  });

  it('does not attach to proposals based only on matching target files', async () => {
    const store = new EvolutionProposalStore(workspace.dir);
    await store.saveProposal(makeProposal('proposal_explicit'));
    await store.saveProposal(makeProposal('proposal_same_target'));
    await new EvolutionFeedbackThreadStore(workspace.dir).saveThread(makeThread());

    await appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'proposal_explicit',
      threadId: 'feedback_thread_1',
    });

    expect((await store.loadProposal('proposal_explicit')).evidenceRefs).toHaveLength(1);
    expect((await store.loadProposal('proposal_same_target')).evidenceRefs).toHaveLength(0);
  });

  it('allows duplicate explicit attachments through proposal revision semantics', async () => {
    await saveProposalAndThread();

    await appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'proposal_feedback',
      threadId: 'feedback_thread_1',
    });
    const second = await appendFeedbackThreadEvidence(workspace.dir, {
      proposalId: 'proposal_feedback',
      threadId: 'feedback_thread_1',
    });

    expect(second.proposal.revision).toBe(3);
    expect(second.proposal.evidenceRefs.map((ref) => ref.path)).toEqual([
      '.playspec/evolution/feedback/threads/feedback_thread_1.yaml',
      '.playspec/evolution/feedback/threads/feedback_thread_1.yaml',
    ]);
  });
});
