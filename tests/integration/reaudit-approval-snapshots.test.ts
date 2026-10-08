import { it, expect, vi } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { writeGateReport } from '../helpers/writeGateReport.js';
import { PlaySpecCore } from '#core/playspec-core.js';

async function setup() {
  const w = await auditWorkspace(); await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' });
  await w.core.setCurrentPhase('task', 'tech_spec_validate'); await writeGateReport(w.dir, 'task', 'tech_spec_validate'); return w;
}
it('rejects artifacts changed between report validation and commit', async () => {
  const w = await setup();
  try {
    const core = w.core as unknown as { writeEvidence: (...args: unknown[]) => Promise<string[]> };
    const original = core.writeEvidence.bind(core);
    const spy = vi.spyOn(core, 'writeEvidence').mockImplementation(async (...args) => {
      const files = await original(...args); await writeFile(path.join(w.dir, 'docs/features/task/spec.md'), 'changed after validation'); return files;
    });
    try { await expect(w.core.completePhase('task', { result: 'approved' })).rejects.toThrow('Approved artifact changed'); } finally { spy.mockRestore(); }
    expect(await w.core.listCompletionEvents('task')).toHaveLength(0);
    expect((await w.store.getTask('task')).currentPhase).toBe('tech_spec_validate');
  } finally { await w.cleanup(); }
});
it('retains evaluated bytes and rejects consumption of changed approved inputs', async () => {
  const w = await setup();
  try {
    const result = await w.core.completePhase('task', { result: 'approved' });
    const artifact = result.completionEvent!.evaluatedArtifacts![0];
    const snapshot = path.join(w.dir, '.playspec/tasks/active/task', artifact.snapshotFile);
    const before = await readFile(snapshot, 'utf8');
    await writeFile(path.join(w.dir, artifact.path), 'changed approved source');
    expect(await readFile(snapshot, 'utf8')).toBe(before);
    await expect(w.core.completePhase('task')).rejects.toThrow('Approved artifact changed');
    await w.core.setCurrentPhase('task', 'tech_spec_validate'); await writeGateReport(w.dir, 'task', 'tech_spec_validate');
    await w.core.completePhase('task', { result: 'approved' });
    await w.core.completePhase('task');
  } finally { await w.cleanup(); }
});
it('rejects tampered evaluated snapshots on subsequent execution', async () => {
  const w = await setup();
  try {
    const result = await w.core.completePhase('task', { result: 'approved' });
    await writeFile(path.join(w.dir, '.playspec/tasks/active/task', result.completionEvent!.evaluatedArtifacts![0].snapshotFile), 'tampered');
    await expect(w.core.completePhase('task')).rejects.toThrow('Approved artifact changed');
  } finally { await w.cleanup(); }
});
