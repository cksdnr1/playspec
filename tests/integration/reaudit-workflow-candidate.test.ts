import { it, expect } from 'vitest';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { WorkflowUpdater } from '#workflow/workflow-updater.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { workflowFiles, BASELINE_FILE } from '#workflow/workflow-manifest.js';

it('rejects a YAML-only update that would reference missing installed templates', async () => {
  const w = await auditWorkspace();
  try {
    const root = path.join(w.dir, '.playspec/workflows/mono-spec'); await mkdir(path.join(root, 'templates'), { recursive: true });
    await writeFile(path.join(root, 'templates/local.md'), '# Local');
    await writeFile(path.join(root, 'workflow.yaml'), stringify({ id: 'mono-spec', mode: 'linear', phaseOrder: ['local'], phases: { local: { title: 'Local', template: 'local.md' } } }));
    const before = await workflowFiles(root); const updater = new WorkflowUpdater(w.dir);
    await expect(updater.update('mono-spec', { apply: true, files: ['workflow.yaml'], acceptCustomized: ['workflow.yaml'] })).rejects.toThrow('Template file not found');
    expect(await workflowFiles(root)).toEqual(before); await expect(readFile(path.join(root, BASELINE_FILE))).rejects.toThrow();
    expect((await new WorkflowLoader(w.dir).resolve('mono-spec')).definition.phaseOrder).toEqual(['local']);
    const preview = await updater.update('mono-spec');
    expect((await updater.update('mono-spec', { apply: true, acceptCustomized: preview.conflicts })).applied).toBe(true);
    expect((await new WorkflowLoader(w.dir).resolve('mono-spec')).definition.phaseOrder).toContain('tech_spec_validate');
  } finally { await w.cleanup(); }
});
it('checks active phases against retained candidate rather than unrelated builtin routes', async () => {
  const w = await auditWorkspace();
  try {
    const root = path.join(w.dir, '.playspec/workflows/mono-spec'); await mkdir(path.join(root, 'templates'), { recursive: true });
    await writeFile(path.join(root, 'templates/local.md'), '# Local');
    await writeFile(path.join(root, 'workflow.yaml'), stringify({ id: 'mono-spec', mode: 'linear', phaseOrder: ['local'], phases: { local: { title: 'Local', template: 'local.md' } } }));
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec', currentPhase: 'local' });
    const result = await new WorkflowUpdater(w.dir).update('mono-spec', { apply: true, files: ['templates/tech_spec_validate.md'] });
    expect(result.applied).toBe(true); expect((await new WorkflowLoader(w.dir).resolve('mono-spec')).definition.phaseOrder).toEqual(['local']);
  } finally { await w.cleanup(); }
});
it('rejects missing includes in retained phase templates before changing runtime assets', async () => {
  const w = await auditWorkspace();
  try {
    const root = path.join(w.dir, '.playspec/workflows/mono-spec'); await mkdir(path.join(root, 'templates'), { recursive: true });
    await writeFile(path.join(root, 'templates/local.md'), '{{include:missing.md}}');
    await writeFile(path.join(root, 'workflow.yaml'), stringify({ id: 'mono-spec', mode: 'linear', phaseOrder: ['local'], phases: { local: { title: 'Local', template: 'local.md' } } }));
    const before = await workflowFiles(root);
    await expect(new WorkflowUpdater(w.dir).update('mono-spec', { apply: true, files: ['templates/tech_spec_validate.md'] })).rejects.toThrow();
    expect(await workflowFiles(root)).toEqual(before);
  } finally { await w.cleanup(); }
});
