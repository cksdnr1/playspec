import path from 'node:path';
import { rm } from 'node:fs/promises';
import { z } from 'zod';
import { parse, stringify } from 'yaml';
import { CompletionEventSchema, TaskRecordSchema, TaskStateSyncSchema, TaskRollbackStateSchema, WorkflowDefinitionSchema, PhaseDefinitionSchema } from '#core/schemas.js';
import type { TaskRecord, CompletePhaseInput, CompletionEvent } from '#core/types.js';
import { getActiveTaskRoot } from '#utils/paths.js';
import { readTextFile, writeTextFileAtomic } from '#utils/fs.js';
import type { TaskStore } from './task-store.js';
import { CompletionFeedbackCapture, renderCompletionFeedback } from '#core/completion-feedback-capture.js';
import type { CompletionFeedbackCaptureInput } from '#core/completion-feedback-capture.js';
import { CompletionLedgerStore } from './completion-ledger-store.js';

const TransactionSchema = z.object({
  version: z.literal(1), before: TaskRecordSchema, event: CompletionEventSchema, markdown: z.string(),
  feedbackRequest: z.object({
    task: TaskRecordSchema,
    workflow: z.object({ id: z.string(), rootDir: z.string(), templateDir: z.string(), source: z.enum(['project', 'user', 'builtin']), definition: WorkflowDefinitionSchema }),
    definition: PhaseDefinitionSchema, phaseId: z.string(), result: z.string().optional(),
    reviewFile: z.string().optional(), snapshotFiles: z.array(z.string()), validationReportFile: z.string().optional(),
  }).optional(),
  input: z.object({
    phaseId: z.string(), nextPhase: z.string().nullable(), result: z.string().optional(),
    reviewFile: z.string().optional(), evidenceFiles: z.array(z.string()),
    snapshotFiles: z.array(z.string()), validationTemplate: z.string().optional(),
    stateSync: TaskStateSyncSchema, rollback: TaskRollbackStateSchema,
    visitCount: z.number().int().positive().optional(),
  }),
});

export class CompletionTransactionStore {
  constructor(private readonly workspaceRoot: string, private readonly taskStore: TaskStore) {}
  private journalPath(taskId: string) { return path.join(getActiveTaskRoot(this.workspaceRoot, taskId), 'completions/pending.yaml'); }

  async prepare(before: TaskRecord, event: CompletionEvent, input: CompletePhaseInput, markdown: string, feedbackRequest?: CompletionFeedbackCaptureInput): Promise<void> {
    const transaction = TransactionSchema.parse({ version: 1, before, event, input, markdown, feedbackRequest });
    await writeTextFileAtomic(this.journalPath(before.id), stringify(transaction));
  }

  async clear(taskId: string): Promise<void> { await rm(this.journalPath(taskId), { force: true }); }

  /** Caller holds the task write lock. A divergent task is never overwritten. */
  async recover(taskId: string): Promise<CompletionEvent | undefined> {
    let content: string;
    try { content = await readTextFile(this.journalPath(taskId)); }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
      throw error;
    }
    const pending = TransactionSchema.parse(parse(content));
    if (pending.before.id !== taskId || pending.event.taskId !== taskId || pending.event.phase !== pending.input.phaseId ||
        (pending.feedbackRequest && (pending.feedbackRequest.task.id !== taskId || pending.feedbackRequest.phaseId !== pending.event.phase)) ||
        pending.event.nextPhase !== pending.input.nextPhase || pending.event.completedAt !== pending.input.stateSync.lastCompletedAt) {
      throw new Error('Pending completion transaction identity is inconsistent.');
    }
    const current = await this.taskStore.getTask(taskId);
    const alreadyApplied = current.currentPhase === pending.input.nextPhase &&
      current.stateSync?.lastCompletedAt === pending.event.completedAt &&
      current.phaseHistory.some(entry => entry.phase === pending.event.phase && entry.completedAt === pending.event.completedAt);
    if (!alreadyApplied && JSON.stringify(current) !== JSON.stringify(pending.before)) {
      throw new Error('Pending completion conflicts with changed task state. Preserve completions/pending.yaml and inspect before recovery.');
    }
    if (pending.feedbackRequest) {
      const feedback = await new CompletionFeedbackCapture(this.workspaceRoot).capture({ ...pending.feedbackRequest,
        observationId: `${taskId}:completion:${pending.event.id}`, createdAt: pending.event.completedAt });
      if (feedback) {
        pending.event.feedback = feedback;
        pending.markdown += `\n## Feedback\n\n${renderCompletionFeedback(feedback)}\n`;
      }
      pending.feedbackRequest = undefined;
      await writeTextFileAtomic(this.journalPath(taskId), stringify(pending));
    }
    await new CompletionLedgerStore(this.workspaceRoot).appendEvent(pending.before, pending.event, pending.markdown);
    if (!alreadyApplied) await this.taskStore.completePhase(taskId, pending.input);
    await this.clear(taskId);
    return pending.event;
  }
}
