import { it, expect } from 'vitest';
import { mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { EvolutionProposalStore } from '#evolution/proposal-store.js';
import { EvolutionApplyRunner } from '#evolution/apply-runner.js';

async function proposal(root: string, file: string) {
  await new EvolutionProposalStore(root).saveProposal({ id: 'proposal_path', revision: 1,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'pending',
    source: { taskId: 'task', artifactRefs: [] }, targetFiles: [file], evidenceRefs: [], riskLevel: 'low',
    actions: [{ actionId: 'a', type: 'replace_file', targetPath: file, content: 'Updated rule', summary: 'Update rule', rationale: 'Reviewed rule' }],
    rationale: 'Update rule', review: { status: 'unreviewed' } });
}
it('rejects approved evolution diff/apply through external parent symlinks', async () => {
  const w = await auditWorkspace(); const outside = await auditWorkspace();
  try {
    await writeFile(path.join(outside.dir, 'rule.md'), 'Original external bytes');
    await mkdir(path.join(w.dir, '.playspec/rules'), { recursive: true });
    await symlink(outside.dir, path.join(w.dir, '.playspec/rules/link'));
    await proposal(w.dir, '.playspec/rules/link/rule.md'); const runner = new EvolutionApplyRunner(w.dir);
    await expect(runner.diff('proposal_path')).rejects.toThrow(/outside/);
    await expect(runner.apply('proposal_path', { approved: true })).rejects.toThrow(/outside/);
    expect(await readFile(path.join(outside.dir, 'rule.md'), 'utf8')).toBe('Original external bytes');
  } finally { await w.cleanup(); await outside.cleanup(); }
});
it('allows internal descendant links and keeps approval required', async () => {
  const w = await auditWorkspace();
  try {
    const dir = path.join(w.dir, '.playspec/rules/real'); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'rule.md'), 'Original rule'); await symlink(dir, path.join(w.dir, '.playspec/rules/link'));
    await proposal(w.dir, '.playspec/rules/link/rule.md'); const runner = new EvolutionApplyRunner(w.dir);
    await expect(runner.apply('proposal_path')).rejects.toThrow('explicit approval');
    expect((await runner.apply('proposal_path', { approved: true })).report.status).toBe('success');
    expect(await readFile(path.join(dir, 'rule.md'), 'utf8')).toBe('Updated rule');
  } finally { await w.cleanup(); }
});
