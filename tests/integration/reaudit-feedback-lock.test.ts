import { it, expect, vi } from 'vitest';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { writeGateReport } from '../helpers/writeGateReport.js';
import { EvolutionFeedbackThreadStore } from '#evolution/feedback-thread-store.js';

it('keeps both observations from concurrent tasks sharing a feedback key', async () => {
  const w = await auditWorkspace();
  try {
    for (const id of ['one', 'two']) {
      await w.store.createTask({ id, title: id, workflow: 'mono-spec' });
      await w.core.setCurrentPhase(id, 'tech_spec_validate'); await writeGateReport(w.dir, id, 'tech_spec_validate');
    }
    const original = EvolutionFeedbackThreadStore.prototype.listThreads;
    const spy = vi.spyOn(EvolutionFeedbackThreadStore.prototype, 'listThreads').mockImplementation(async function () {
      const read = await original.call(this); await new Promise(resolve => setTimeout(resolve, 25)); return read;
    });
    try {
      const results = await Promise.all(['one', 'two'].map(id => w.core.completePhase(id, { expectedPhaseId: 'tech_spec_validate', result: 'approved' })));
      expect(results.map(r => r.feedback?.status)).toEqual(['captured', 'captured']);
    } finally { spy.mockRestore(); }
    const threads = await new EvolutionFeedbackThreadStore(w.dir).listThreads();
    expect(threads).toHaveLength(1); expect(threads[0].events.map(event => event.taskId).sort()).toEqual(['one', 'two']);
    expect(threads[0].trend.totalEvents).toBe(2);
  } finally { await w.cleanup(); }
});
