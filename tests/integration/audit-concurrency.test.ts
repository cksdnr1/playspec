import { it, expect } from 'vitest';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

it('revalidates expectedPhaseId inside the lock for simultaneous callers', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const calls = await Promise.allSettled([w.core.completePhase('task', { expectedPhaseId: 'a' }), w.core.completePhase('task', { expectedPhaseId: 'a' })]);
    expect(calls.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(calls.filter(x => x.status === 'rejected')).toHaveLength(1);
    expect((await w.store.getTask('task')).phaseHistory.map(x => x.phase)).toEqual(['a']);
    expect(await w.core.listCompletionEvents('task')).toHaveLength(1);
  } finally { await w.cleanup(); }
});
it('deduplicates concurrent requests and final completion retries', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const options = { expectedPhaseId: 'a', requestId: 'unique-a' };
    const [one, two] = await Promise.all([w.core.completePhase('task', options), w.core.completePhase('task', options)]);
    expect(two.completionEvent?.id).toBe(one.completionEvent?.id);
    expect(await w.core.listCompletionEvents('task')).toHaveLength(1);
    await expect(w.core.completePhase('task', { ...options, expectedPhaseId: 'b' })).rejects.toThrow(/different completion/);
    await w.core.completePhase('task', { expectedPhaseId: 'b' });
    const final = await w.core.completePhase('task', { expectedPhaseId: 'c', requestId: 'unique-c' });
    expect((await w.core.completePhase('task', { expectedPhaseId: 'c', requestId: 'unique-c' })).completionEvent?.id).toBe(final.completionEvent?.id);
    expect(await w.core.listCompletionEvents('task')).toHaveLength(3);
  } finally { await w.cleanup(); }
});
it('keeps simultaneous context additions instead of losing an update', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    await Promise.all([w.core.addContextRef('task', '.playspec/workflows/audit/workflow.yaml'), w.core.addContextRef('task', '.playspec/workflows/audit/templates/step.md')]);
    expect((await w.store.getTask('task')).contextRefs).toHaveLength(2);
  } finally { await w.cleanup(); }
});
