import { it, expect } from 'vitest';
import { writeFile, mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

it.each(['missing', 'empty', 'directory', 'escape'])('rejects %s phase output without recording completion', async kind => {
  const w = await auditWorkspace();
  try {
    w.definition.phases.a.requiredOutputs = ['deliverable.md']; await w.writeWorkflow();
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    const output = path.join(w.dir, 'deliverable.md');
    if (kind === 'empty') await writeFile(output, '');
    if (kind === 'directory') await mkdir(output);
    if (kind === 'escape') await symlink('/etc/hosts', output);
    await expect(w.core.completePhase('task')).rejects.toThrow('Required output');
    expect(await w.core.listCompletionEvents('task')).toEqual([]);
    expect((await w.store.getTask('task')).currentPhase).toBe(null);
  } finally { await w.cleanup(); }
});
it('requires final deliverables only on terminal transitions and keeps optional artifacts optional', async () => {
  const w = await auditWorkspace();
  try {
    w.definition.phases.a.requiredOutputs = ['draft.md'];
    w.definition.artifacts = { final: { path: 'final.md', required: true }, optional: { path: 'optional.md' } };
    await w.writeWorkflow(); await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    await writeFile(path.join(w.dir, 'draft.md'), '# Draft');
    await w.core.completePhase('task'); await w.core.completePhase('task');
    await expect(w.core.completePhase('task')).rejects.toThrow('final.md');
    await writeFile(path.join(w.dir, 'final.md'), '# Final');
    const result = await w.core.completePhase('task'); expect(result.isWorkflowComplete).toBe(true);
    expect(result.finalizedArtifacts.find(a => a.role === 'optional')?.exists).toBe(false);
  } finally { await w.cleanup(); }
});
