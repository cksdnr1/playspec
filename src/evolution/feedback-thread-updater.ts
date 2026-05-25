import { createHash } from 'node:crypto';
import {
  FeedbackThreadSchema,
} from './schemas.js';
import { EvolutionFeedbackThreadStore } from './feedback-thread-store.js';
import { FeedbackWorkflowSourceResolver } from './feedback-workflow-source-resolver.js';
import { PromptSnapshotHasher } from './prompt-snapshot-hasher.js';
import type {
  FeedbackConfidence,
  FeedbackDedupeKey,
  FeedbackHistoryOverflowSummary,
  FeedbackProposalReadinessState,
  FeedbackSignalResult,
  FeedbackThread,
  FeedbackThreadEvent,
  FeedbackThreadUpdateInput,
  FeedbackThreadUpdateResult,
  FeedbackTrendDirection,
} from './types.js';

export class FeedbackThreadUpdater {
  private readonly store: EvolutionFeedbackThreadStore;
  private readonly sourceResolver: FeedbackWorkflowSourceResolver;
  private readonly snapshotHasher: PromptSnapshotHasher;

  constructor(private readonly workspaceRoot: string) {
    this.store = new EvolutionFeedbackThreadStore(workspaceRoot);
    this.sourceResolver = new FeedbackWorkflowSourceResolver(workspaceRoot);
    this.snapshotHasher = new PromptSnapshotHasher(workspaceRoot);
  }

  async update(input: FeedbackThreadUpdateInput): Promise<FeedbackThreadUpdateResult> {
    const now = input.createdAt ?? new Date().toISOString();
    const feedbackConfig = {
      ...input.feedbackConfig,
      ...(input.evolutionTargetPhaseId ? { evolutionTargetPhaseId: input.evolutionTargetPhaseId } : {}),
    };
    const promptSnapshot = await this.snapshotHasher.hashTargetPrompt(
      input.task,
      input.workflow,
      feedbackConfig.evolutionTargetPhaseId,
      new Date(now)
    );
    const dedupeKey = buildDedupeKey(input, feedbackConfig.evolutionTargetPhaseId);
    const dedupeKeyHash = hashCanonical(dedupeKey);
    const existing = (await this.store.listThreads()).find((thread) => thread.dedupeKeyHash === dedupeKeyHash);
    const resolution = this.sourceResolver.resolve(input.workflow, feedbackConfig);
    const event: FeedbackThreadEvent = {
      eventId: buildEventId(now, input.task.id, input.phaseId),
      taskId: input.task.id,
      phaseId: input.phaseId,
      createdAt: now,
      approvalResult: input.approvalResult,
      feedbackResult: input.feedbackResult,
      ...(input.score !== undefined ? { score: input.score } : {}),
      causeClassification: input.causeClassification,
      summary: input.summary,
      promptSnapshot,
      ...(input.rawObservationRef !== undefined ? { rawObservationRef: input.rawObservationRef } : {}),
    };

    const thread = existing
      ? updateExistingThread(existing, event, now)
      : createThread(input, event, now, dedupeKey, dedupeKeyHash, resolution);
    const compacted = compactThreadHistory(thread);
    const withTrend = {
      ...compacted,
      trend: computeTrend(compacted),
    };
    const validated = FeedbackThreadSchema.parse(withTrend) as FeedbackThread;
    const threadPath = await this.store.upsertThread(validated);

    return {
      thread: validated,
      threadPath,
      created: existing === undefined,
    };
  }
}

function buildDedupeKey(input: FeedbackThreadUpdateInput, evolutionTargetPhaseId: string): FeedbackDedupeKey {
  const fields: Record<string, string> = {};
  for (const field of [...input.feedbackConfig.dedupe.fields].sort()) {
    fields[field] = input.dedupeFieldValues?.[field] ?? input.task.variables[field] ?? '';
  }

  return {
    version: 1,
    workflowId: input.workflow.id,
    feedbackKind: input.feedbackConfig.kind,
    sourcePhaseId: input.feedbackConfig.sourcePhaseId,
    evaluatedArtifactPhaseId: input.feedbackConfig.evaluatedArtifactPhaseId,
    evolutionTargetPhaseId,
    causeCategory: input.causeClassification.selected,
    fields,
  };
}

function createThread(
  input: FeedbackThreadUpdateInput,
  event: FeedbackThreadEvent,
  now: string,
  dedupeKey: FeedbackDedupeKey,
  dedupeKeyHash: string,
  resolution: ReturnType<FeedbackWorkflowSourceResolver['resolve']>
): FeedbackThread {
  return {
    id: `feedback_${dedupeKeyHash.slice(0, 24)}`,
    createdAt: now,
    updatedAt: now,
    dedupeKey,
    dedupeKeyHash,
    sourcePhaseId: input.feedbackConfig.sourcePhaseId,
    evaluatedArtifactPhaseId: input.feedbackConfig.evaluatedArtifactPhaseId,
    evolutionTargetPhaseId: dedupeKey.evolutionTargetPhaseId,
    workflowSource: resolution.workflowSource,
    targetPromptTemplate: resolution.targetPromptTemplate,
    targetWritable: resolution.targetWritable,
    targetPath: resolution.targetPath,
    compactHistoryPolicy: input.feedbackConfig.compactHistoryPolicy,
    proposalReadinessPolicy: input.feedbackConfig.proposalReadinessPolicy,
    mutationStrategy: 'manual_review_only',
    trend: emptyTrend(),
    events: [event],
  };
}

function updateExistingThread(thread: FeedbackThread, event: FeedbackThreadEvent, now: string): FeedbackThread {
  return {
    ...thread,
    updatedAt: now,
    events: [...thread.events, event],
  };
}

function compactThreadHistory(thread: FeedbackThread): FeedbackThread {
  const policy = thread.compactHistoryPolicy;
  if (thread.events.length <= policy.maxEntries) {
    return thread;
  }

  const first = policy.keepFirst ? thread.events[0] : undefined;
  const latestLimit = Math.min(policy.keepLatest, policy.keepFirst ? policy.maxEntries - 1 : policy.maxEntries);
  const latest = latestLimit > 0 ? thread.events.slice(-latestLimit) : [];
  const retainedIds = new Set([...latest, ...(first ? [first] : [])].map((event) => event.eventId));
  const omitted = thread.events.filter((event) => !retainedIds.has(event.eventId));
  const retained = [...(first ? [first] : []), ...latest.filter((event) => event.eventId !== first?.eventId)];
  const historyOverflowSummary = mergeOverflow(thread.historyOverflowSummary, omitted);

  return {
    ...thread,
    events: retained,
    ...(historyOverflowSummary.omittedEventCount > 0 ? { historyOverflowSummary } : {}),
  };
}

function mergeOverflow(
  existing: FeedbackHistoryOverflowSummary | undefined,
  omitted: FeedbackThreadEvent[]
): FeedbackHistoryOverflowSummary {
  const added = summarizeEvents(omitted);
  if (!existing) {
    return added;
  }

  return {
    omittedEventCount: existing.omittedEventCount + added.omittedEventCount,
    positiveCount: existing.positiveCount + added.positiveCount,
    negativeCount: existing.negativeCount + added.negativeCount,
    neutralCount: existing.neutralCount + added.neutralCount,
    parseFailureCount: existing.parseFailureCount + added.parseFailureCount,
    firstOmittedAt: minTimestamp(existing.firstOmittedAt, added.firstOmittedAt),
    lastOmittedAt: maxTimestamp(existing.lastOmittedAt, added.lastOmittedAt),
  };
}

function summarizeEvents(events: FeedbackThreadEvent[]): FeedbackHistoryOverflowSummary {
  return {
    omittedEventCount: events.length,
    positiveCount: countResult(events, 'positive'),
    negativeCount: countResult(events, 'negative'),
    neutralCount: countResult(events, 'neutral'),
    parseFailureCount: countResult(events, 'parse_failed'),
    firstOmittedAt: events[0]?.createdAt,
    lastOmittedAt: events.at(-1)?.createdAt,
  };
}

function computeTrend(thread: FeedbackThread) {
  const overflow = thread.historyOverflowSummary;
  const positiveCount = countResult(thread.events, 'positive') + (overflow?.positiveCount ?? 0);
  const negativeCount = countResult(thread.events, 'negative') + (overflow?.negativeCount ?? 0);
  const neutralCount = countResult(thread.events, 'neutral') + (overflow?.neutralCount ?? 0);
  const parseFailureCount = countResult(thread.events, 'parse_failed') + (overflow?.parseFailureCount ?? 0);
  const totalEvents = positiveCount + negativeCount + neutralCount + parseFailureCount;

  return {
    totalEvents,
    positiveCount,
    negativeCount,
    neutralCount,
    parseFailureCount,
    direction: trendDirection(positiveCount, negativeCount),
    confidence: trendConfidence(totalEvents, negativeCount, thread.proposalReadinessPolicy),
    readinessState: readinessState(totalEvents, negativeCount, thread.proposalReadinessPolicy),
    lastEventAt: thread.events.at(-1)?.createdAt,
  };
}

function emptyTrend() {
  return {
    totalEvents: 0,
    positiveCount: 0,
    negativeCount: 0,
    neutralCount: 0,
    parseFailureCount: 0,
    direction: 'unknown' as FeedbackTrendDirection,
    confidence: 'low' as FeedbackConfidence,
    readinessState: 'not_ready' as FeedbackProposalReadinessState,
  };
}

function countResult(events: FeedbackThreadEvent[], result: FeedbackSignalResult): number {
  return events.filter((event) => event.feedbackResult === result).length;
}

function trendDirection(positiveCount: number, negativeCount: number): FeedbackTrendDirection {
  if (positiveCount === 0 && negativeCount === 0) return 'unknown';
  if (positiveCount > negativeCount) return 'improving';
  if (negativeCount > positiveCount) return 'declining';
  return 'stable';
}

function trendConfidence(
  totalEvents: number,
  negativeCount: number,
  policy: FeedbackThread['proposalReadinessPolicy']
): FeedbackConfidence {
  return totalEvents >= policy.minRunCount && negativeCount >= policy.minNegativeCount ? policy.minConfidence : 'low';
}

function readinessState(
  totalEvents: number,
  negativeCount: number,
  policy: FeedbackThread['proposalReadinessPolicy']
): FeedbackProposalReadinessState {
  return totalEvents >= policy.minRunCount && negativeCount >= policy.minNegativeCount ? 'ready_for_review' : 'not_ready';
}

function buildEventId(createdAt: string, taskId: string, phaseId: string): string {
  const suffix = hashCanonical({ createdAt, taskId, phaseId }).slice(0, 10);
  return `event_${normalizeTimestamp(createdAt)}_${suffix}`;
}

function normalizeTimestamp(timestamp: string): string {
  return timestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'z').replace(/[^A-Za-z0-9_-]/g, '').toLowerCase();
}

function hashCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function minTimestamp(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return left <= right ? left : right;
}

function maxTimestamp(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}
