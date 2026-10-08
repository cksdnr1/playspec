import { it, expect, vi } from 'vitest';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { MigrationRunner } from '#migration/migration-runner.js';
import { MigrationStore } from '#migration/migration-store.js';
import type { MigrationPlan } from '#migration/types.js';

function promotion(): MigrationPlan {
  const target = '.playspec/tasks/active/task/task.yaml';
  return { id: 'race', createdAt: new Date().toISOString(), mode: 'auto', sourceRoot: '.', targetTaskId: 'task', sourceFiles: [], targetFiles: [target],
    actions: [{ actionId: 'a', type: 'update_task_state', targetPath: target, sourcePaths: [], reason: 'Title update', evidence: 'Explicit title', riskLevel: 'low', preview: '', backupRequired: false, requiresReview: false, fieldPath: 'title', previousValue: 'Task', proposedValue: 'New' }],
    statePromotions: [{ fieldPath: 'title', previousValue: 'Task', proposedValue: 'New', evidenceSources: [], confidence: 'deterministic', reason: 'Explicit', requiresReview: false }], riskLevel: 'low', requiresReview: false, summary: 'Title update', warnings: [] };
}
it('preserves title and completion when migration backup overlaps a queued completion', async () => {
  const w = await auditWorkspace(); let completion: ReturnType<typeof w.core.completePhase> | undefined;
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const original = MigrationStore.prototype.createBackup;
    const spy = vi.spyOn(MigrationStore.prototype, 'createBackup').mockImplementation(async function (...args) {
      completion = w.core.completePhase('task', { expectedPhaseId: 'a' });
      return original.apply(this, args);
    });
    try { await new MigrationRunner(w.dir, w.store).run(promotion()); await completion; } finally { spy.mockRestore(); }
    const task = await w.store.getTask('task'); expect(task.title).toBe('New'); expect(task.currentPhase).toBe('b');
    expect(task.phaseHistory.map(h => h.phase)).toEqual(['a']); expect(await w.core.listCompletionEvents('task')).toHaveLength(1);
  } finally { await w.cleanup(); }
});
it('recovers pending completion before applying a structured migration', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const spy = vi.spyOn(w.store, 'completePhase').mockRejectedValueOnce(new Error('Injected task write failure'));
    try { await expect(w.core.completePhase('task', { expectedPhaseId: 'a' })).rejects.toThrow('Injected'); } finally { spy.mockRestore(); }
    await new MigrationRunner(w.dir, w.store).run(promotion());
    const task = await w.store.getTask('task'); expect(task.title).toBe('New'); expect(task.currentPhase).toBe('b');
    expect(task.phaseHistory).toHaveLength(1); expect(await w.core.listCompletionEvents('task')).toHaveLength(1);
  } finally { await w.cleanup(); }
});
