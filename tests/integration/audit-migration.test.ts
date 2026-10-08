import { it, expect, vi } from 'vitest';
import { mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { MigrationRunner } from '#migration/migration-runner.js';
import { MigrationStore } from '#migration/migration-store.js';
import type { MigrationPlan } from '#migration/types.js';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

function plan(targetPath = 'docs/file.md'): MigrationPlan {
  return { id: 'audit', createdAt: new Date().toISOString(), mode: 'auto', sourceRoot: '.', targetTaskId: 'task', sourceFiles: [], targetFiles: [targetPath], actions: [{ actionId: 'a', type: 'update_file', targetPath, sourcePaths: [], reason: 'audit', evidence: 'audit', riskLevel: 'high', preview: '', backupRequired: false, requiresReview: false, content: 'changed' }], statePromotions: [], riskLevel: 'high', requiresReview: false, summary: 'audit', warnings: [] };
}
it.each(['../outside.md', '/tmp/outside.md', '.git/config', '.playspec/tasks/active/task/task.yaml'])('rejects unsafe target %s before mutation', async target => {
  const w = await auditWorkspace();
  try { await expect(new MigrationRunner(w.dir, w.store).run(plan(target))).rejects.toThrow(); }
  finally { await w.cleanup(); }
});
it('rejects external symlinks and unsafe plan IDs', async () => {
  const w = await auditWorkspace();
  try {
    await symlink(path.dirname(w.dir), path.join(w.dir, 'docs'));
    await expect(new MigrationRunner(w.dir, w.store).run(plan())).rejects.toThrow(/outside/);
    await expect(new MigrationRunner(w.dir, w.store).run({ ...plan(), id: '../escape' })).rejects.toThrow();
  } finally { await w.cleanup(); }
});
it('does not trust high-risk auto actions or disabled backup flags', async () => {
  const w = await auditWorkspace();
  try {
    await mkdir(path.join(w.dir, 'docs')); const target = path.join(w.dir, 'docs/file.md'); await writeFile(target, 'original');
    const runner = new MigrationRunner(w.dir, w.store);
    await runner.run(plan()); expect(await readFile(target, 'utf8')).toBe('original');
    const spy = vi.spyOn(MigrationStore.prototype, 'createBackup').mockRejectedValue(new Error('backup failed'));
    try {
      const result = await runner.run({ ...plan(), mode: 'review' });
      expect(await readFile(target, 'utf8')).toBe('original');
      expect(await readFile(result.reportPath, 'utf8')).toContain('backup failed');
    } finally { spy.mockRestore(); }
  } finally { await w.cleanup(); }
});
it('auto applies only a low-risk deterministic structured promotion', async () => {
  const w = await auditWorkspace();
  try {
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const p = plan('.playspec/tasks/active/task/task.yaml'); p.riskLevel = 'low';
    p.actions = [{ ...p.actions[0], type: 'update_task_state', riskLevel: 'low', fieldPath: 'title', previousValue: 'Task', proposedValue: 'New' }];
    p.statePromotions = [{ fieldPath: 'title', previousValue: 'Task', proposedValue: 'New', evidenceSources: [], confidence: 'deterministic', reason: 'explicit', requiresReview: false }];
    await new MigrationRunner(w.dir, w.store).run(p); expect((await w.store.getTask('task')).title).toBe('New');
  } finally { await w.cleanup(); }
});
