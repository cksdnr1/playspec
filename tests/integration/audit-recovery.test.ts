import { it, expect, vi } from 'vitest';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { CompletionLedgerStore } from '#storage/completion-ledger-store.js';
import { CompletionTransactionStore } from '#storage/completion-transaction-store.js';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

it.each(['ledger', 'task', 'cleanup'])('recovers a %s commit failure exactly once', async stage => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const spy = stage === 'ledger' ? vi.spyOn(CompletionLedgerStore.prototype, 'appendEvent').mockRejectedValueOnce(new Error('injected ledger failure'))
      : stage === 'task' ? vi.spyOn(w.store, 'completePhase').mockRejectedValueOnce(new Error('injected task failure'))
      : vi.spyOn(CompletionTransactionStore.prototype, 'clear').mockRejectedValueOnce(new Error('injected cleanup failure'));
    const options = { expectedPhaseId: 'a', requestId: 'one-request' };
    try { await expect(w.core.completePhase('task', options)).rejects.toThrow(/injected/); }
    finally { spy.mockRestore(); }
    const result = await w.core.completePhase('task', options);
    expect(result.completedPhase).toBe('a'); expect(result.nextPhase).toBe('b');
    expect((await w.store.getTask('task')).phaseHistory.map(x => x.phase)).toEqual(['a']);
    expect(await w.core.listCompletionEvents('task')).toHaveLength(1);
    await expect(readFile(path.join(w.dir, '.playspec/tasks/active/task/completions/pending.yaml'))).rejects.toThrow();
  } finally { await w.cleanup(); }
});
it('refuses to overwrite a task changed after a failed commit', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const spy = vi.spyOn(w.store, 'completePhase').mockRejectedValueOnce(new Error('injected'));
    try { await expect(w.core.completePhase('task')).rejects.toThrow('injected'); } finally { spy.mockRestore(); }
    await w.store.updateTask('task', { title: 'Concurrent manual edit' });
    await expect(w.core.getTaskStatus('task')).rejects.toThrow(/conflicts/);
    expect((await w.store.getTask('task')).title).toBe('Concurrent manual edit');
  } finally { await w.cleanup(); }
});
it('preserves historical snapshot bytes when rollback is followed by recompletion', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const first = await w.core.completePhase('task'); const taskRoot = path.join(w.dir, '.playspec/tasks/active/task');
    const originalPath = path.join(taskRoot, first.snapshotFiles[0]); const original = await readFile(originalPath, 'utf8');
    await w.core.rollbackStateOnly('task');
    const second = await w.core.completePhase('task');
    expect(second.snapshotFiles[0]).not.toBe(first.snapshotFiles[0]);
    expect(await readFile(originalPath, 'utf8')).toBe(original);
    expect(await w.core.listCompletionEvents('task')).toHaveLength(2);
    expect((await readdir(path.join(taskRoot, 'completions'))).some(name => name.startsWith('rollback-'))).toBe(true);
  } finally { await w.cleanup(); }
});
it('preserves orphan evidence from a failed pre-commit attempt', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const orphan = path.join(w.dir, '.playspec/tasks/active/task/snapshots/phasea_before_complete.yaml');
    await writeFile(orphan, 'orphan evidence');
    const result = await w.core.completePhase('task');
    expect(result.snapshotFiles[0]).not.toBe('snapshots/phasea_before_complete.yaml');
    expect(await readFile(orphan, 'utf8')).toBe('orphan evidence');
  } finally { await w.cleanup(); }
});
