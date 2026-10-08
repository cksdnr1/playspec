import { it, expect, vi } from 'vitest';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { writeGateReport } from '../helpers/writeGateReport.js';
import { CompletionTransactionStore } from '#storage/completion-transaction-store.js';
import { CompletionFeedbackCapture } from '#core/completion-feedback-capture.js';
import { EvolutionFeedbackThreadStore } from '#evolution/feedback-thread-store.js';
import { FeedbackThreadUpdater } from '#evolution/feedback-thread-updater.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';

async function setup() {
  const w = await auditWorkspace(); await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' });
  await w.core.setCurrentPhase('task', 'tech_spec_validate'); await writeGateReport(w.dir, 'task', 'tech_spec_validate'); return w;
}
it('does not write feedback before journal preparation and counts retry exactly once', async () => {
  const w = await setup();
  try {
    const spy = vi.spyOn(CompletionTransactionStore.prototype, 'prepare').mockRejectedValueOnce(new Error('Injected prepare failure'));
    const options = { expectedPhaseId: 'tech_spec_validate', result: 'approved', requestId: 'same' };
    try { await expect(w.core.completePhase('task', options)).rejects.toThrow('Injected'); } finally { spy.mockRestore(); }
    expect(await new EvolutionFeedbackThreadStore(w.dir).listThreads()).toEqual([]);
    await w.core.completePhase('task', options);
    expect((await new EvolutionFeedbackThreadStore(w.dir).listThreads())[0].events).toHaveLength(1);
    expect(await w.core.listCompletionEvents('task')).toHaveLength(1);
  } finally { await w.cleanup(); }
});
it('recovers after feedback write before journal outcome persistence without double counting', async () => {
  const w = await setup();
  try {
    const original = CompletionFeedbackCapture.prototype.capture; let failed = false;
    const spy = vi.spyOn(CompletionFeedbackCapture.prototype, 'capture').mockImplementation(async function (input, validateOnly) {
      const result = await original.call(this, input, validateOnly);
      if (!validateOnly && !failed) { failed = true; throw new Error('Injected post-feedback crash'); }
      return result;
    });
    const options = { expectedPhaseId: 'tech_spec_validate', result: 'approved', requestId: 'same' };
    try { await expect(w.core.completePhase('task', options)).rejects.toThrow('Injected'); } finally { spy.mockRestore(); }
    expect((await new EvolutionFeedbackThreadStore(w.dir).listThreads())[0].events).toHaveLength(1);
    const result = await w.core.completePhase('task', options); expect(result.feedback?.status).toBe('captured');
    expect((await new EvolutionFeedbackThreadStore(w.dir).listThreads())[0].trend.totalEvents).toBe(1);
    expect(await w.core.listCompletionEvents('task')).toHaveLength(1); expect((await w.store.getTask('task')).phaseHistory).toHaveLength(1);
  } finally { await w.cleanup(); }
});
it('retains observation deduplication identity after display history compaction', async () => {
  const w = await setup();
  try {
    const workflow = await new WorkflowLoader(w.dir).resolve('mono-spec'); const feedbackConfig = workflow.definition.phases.tech_spec_validate.feedback!;
    const input = { task: await w.store.getTask('task'), workflow, feedbackConfig, phaseId: 'tech_spec_validate', approvalResult: 'approved' as const,
      feedbackResult: 'positive' as const, causeClassification: { selected: 'artifact_quality_issue' as const, confidence: 'high' as const }, summary: 'Review observation', score: 96 };
    const updater = new FeedbackThreadUpdater(w.dir); await updater.update({ ...input, observationId: 'old' });
    for (let i = 0; i < 22; i++) await updater.update({ ...input, observationId: `new-${i}` });
    const before = (await new EvolutionFeedbackThreadStore(w.dir).listThreads())[0]; expect(before.events.some(e => e.eventId === 'old')).toBe(true);
    // keepFirst preserves the first event; use an intermediate observation that is actually compacted.
    expect(before.events.some(e => e.eventId === 'new-0')).toBe(false);
    const replay = await updater.update({ ...input, observationId: 'new-0' });
    expect(replay.thread.trend.totalEvents).toBe(before.trend.totalEvents);
    expect(replay.thread.events).toHaveLength(before.events.length);
  } finally { await w.cleanup(); }
});
