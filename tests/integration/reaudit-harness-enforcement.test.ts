import { it, expect } from 'vitest';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

it('blocks completion at retry exhaustion until explicit reset', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    for (let i = 0; i < 3; i++) await w.core.recordHarnessAttempt('task', 'a', 'failure', 'Build failed');
    const harness = await w.core.getHarnessStatus('task'); expect(harness.blocked).toBe(true); expect(harness.circuitBreaker).toBe(true);
    await expect(w.core.completePhase('task')).rejects.toThrow(/blocked/i);
    expect(await w.core.listCompletionEvents('task')).toEqual([]); expect((await w.store.getTask('task')).phaseHistory).toEqual([]);
    expect(await w.core.renderNextPrompt('task')).toContain('Task');
    await w.core.resetHarness('task', 'Reviewed failure and fixed build');
    expect((await w.core.completePhase('task')).nextPhase).toBe('b');
  } finally { await w.cleanup(); }
});
it('does not allow another phase attempt to erase the current block', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    for (let i = 0; i < 3; i++) await w.core.recordHarnessAttempt('task', 'a', 'failure');
    await expect(w.core.recordHarnessAttempt('task', 'b', 'success')).rejects.toThrow();
    expect((await w.core.getHarnessStatus('task')).blocked).toBe(true);
    await expect(w.core.completePhase('task')).rejects.toThrow(/blocked/i);
  } finally { await w.cleanup(); }
});
it('rejects stale attempts after a concurrent phase transition', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    await w.core.completePhase('task', { expectedPhaseId: 'a' });
    await expect(w.core.recordHarnessAttempt('task', 'a', 'failure')).rejects.toThrow();
    expect((await w.core.getHarnessStatus('task')).attemptCount).toBe(0);
  } finally { await w.cleanup(); }
});
