import path from 'node:path';
import { EvolutionFeedbackThreadStore } from './feedback-thread-store.js';
import { EvolutionProposalStore } from './proposal-store.js';
import type {
  AppendFeedbackThreadEvidenceInput,
  AppendFeedbackThreadEvidenceResult,
  FeedbackThread,
  FeedbackThreadEvent,
} from './types.js';
import { getEvolutionFeedbackThreadPath } from '#utils/paths.js';

const MAX_EVENT_SUMMARIES = 3;

export async function appendFeedbackThreadEvidence(
  workspaceRoot: string,
  input: AppendFeedbackThreadEvidenceInput
): Promise<AppendFeedbackThreadEvidenceResult> {
  const threadStore = new EvolutionFeedbackThreadStore(workspaceRoot);
  const proposalStore = new EvolutionProposalStore(workspaceRoot);
  const thread = await threadStore.loadThread(input.threadId);
  const absoluteThreadPath = getEvolutionFeedbackThreadPath(workspaceRoot, thread.id);
  const evidencePath = toWorkspaceRelativePath(workspaceRoot, absoluteThreadPath);
  const evidenceNote = buildFeedbackThreadEvidenceNote(thread);
  const result = await proposalStore.appendEvidence(input.proposalId, {
    path: evidencePath,
    note: evidenceNote,
  });

  return {
    ...result,
    threadId: thread.id,
    threadPath: evidencePath,
    evidencePath,
    evidenceNote,
  };
}

function buildFeedbackThreadEvidenceNote(thread: FeedbackThread): string {
  const lines = [
    `Feedback thread ${thread.id} for ${thread.sourcePhaseId} -> ${thread.evolutionTargetPhaseId}.`,
    `Target: ${thread.targetPath} (writable: ${thread.targetWritable}, source: ${thread.workflowSource.kind}).`,
    `Trend: ${thread.trend.direction}, readiness: ${thread.trend.readinessState}, total events: ${thread.trend.totalEvents}, positive: ${thread.trend.positiveCount}, negative: ${thread.trend.negativeCount}, neutral: ${thread.trend.neutralCount}, parse_failed: ${thread.trend.parseFailureCount}.`,
    `Latest summaries: ${summarizeLatestEvents(thread.events)}.`,
    ...overflowSummaryLine(thread),
    `Target strategy: ${targetStrategy(thread)}`,
  ];

  return lines.join('\n');
}

function summarizeLatestEvents(events: FeedbackThreadEvent[]): string {
  const summaries = events.slice(-MAX_EVENT_SUMMARIES).map((event) => event.summary.trim()).filter(Boolean);
  return summaries.length > 0 ? summaries.join(' | ') : 'none';
}

function overflowSummaryLine(thread: FeedbackThread): string[] {
  const overflow = thread.historyOverflowSummary;
  if (!overflow) {
    return [];
  }

  const timestamps = [
    overflow.firstOmittedAt ? `first: ${overflow.firstOmittedAt}` : undefined,
    overflow.lastOmittedAt ? `last: ${overflow.lastOmittedAt}` : undefined,
  ].filter(Boolean).join(', ');
  const suffix = timestamps ? ` (${timestamps})` : '';
  return [`History overflow: ${overflow.omittedEventCount} omitted event(s)${suffix}.`];
}

function targetStrategy(thread: FeedbackThread): string {
  if (
    thread.targetWritable &&
    (thread.workflowSource.kind === 'project_local' || thread.workflowSource.kind === 'user_global')
  ) {
    return 'mutate project-local/user-global proposal target only after review.';
  }

  return 'create a project-local workflow override or user-global workflow copy; do not mutate bundled/external/read-only targets directly.';
}

function toWorkspaceRelativePath(workspaceRoot: string, filePath: string): string {
  return path.relative(workspaceRoot, filePath).split(path.sep).join(path.posix.sep);
}
