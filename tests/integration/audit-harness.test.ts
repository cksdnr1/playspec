import { it, expect } from 'vitest';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

it('uses a fresh budget in both status and mutations after a phase change', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    for (let n = 0; n < 3; n++) await w.core.recordHarnessAttempt('task', 'a', 'failure');
    await w.core.setCurrentPhase('task', 'b');
    expect(await w.core.getHarnessStatus('task')).toMatchObject({ phaseId: 'b', blocked: false, attemptCount: 0 });
    expect(await w.core.recordHarnessAttempt('task', 'b', 'failure')).toMatchObject({ phaseId: 'b', blocked: false, attemptCount: 1 });
  } finally { await w.cleanup(); }
});
it('reset replenishes the budget and preserves the audit trail', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    for (let n = 0; n < 3; n++) await w.core.recordHarnessAttempt('task', 'a', 'failure', 'failed');
    expect(await w.core.resetHarness('task', 'reviewed')).toMatchObject({ attemptCount: 0, lastResult: null, lastFailureReason: null, blocked: false });
    const first = await w.core.recordHarnessAttempt('task', 'a', 'failure');
    expect(first.attemptCount).toBe(1); expect(first.blocked).toBe(false); expect(first.resetEvents).toHaveLength(1);
    await w.core.recordHarnessAttempt('task', 'a', 'failure');
    expect((await w.core.recordHarnessAttempt('task', 'a', 'failure')).blocked).toBe(true);
  } finally { await w.cleanup(); }
});
