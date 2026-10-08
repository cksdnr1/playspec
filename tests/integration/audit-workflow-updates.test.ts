import { it, expect } from 'vitest';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { auditWorkspace } from '../helpers/auditWorkspace.js';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { WorkflowUpdater } from '#workflow/workflow-updater.js';
import { workflowFiles, writeWorkflowBaseline, BASELINE_FILE } from '#workflow/workflow-manifest.js';

async function setup() {
  const w = await auditWorkspace(); const registry = new WorkflowRegistry(w.dir);
  const source = path.join(registry.getBuiltinRoot(), 'mono-spec'); const root = path.join(registry.getProjectRoot(), 'mono-spec');
  await cp(source, root, { recursive: true }); return { ...w, source, root, updater: new WorkflowUpdater(w.dir) };
}
it('detects template-only and gate-only drift and preserves selected installed contents', async () => {
  const w = await setup();
  try {
    await writeFile(path.join(w.root, 'templates/tech_spec_validate.md'), '# Customized review');
    const first = await new WorkflowLoader(w.dir).resolve('mono-spec');
    expect(first.diagnostics?.[0].details.some(d => d.field === 'files.templates/tech_spec_validate.md')).toBe(true);
    const definition = first.definition; definition.phases.tech_spec_validate.gate!.validation!.threshold = 99;
    await writeFile(path.join(w.root, 'workflow.yaml'), stringify(definition));
    expect((await new WorkflowLoader(w.dir).resolve('mono-spec')).diagnostics?.[0].details.some(d => d.field === 'definition')).toBe(true);
    expect(await readFile(path.join(w.root, 'templates/tech_spec_validate.md'), 'utf8')).toBe('# Customized review');
  } finally { await w.cleanup(); }
});
it('previews without writes and safely updates baseline content with backups and idempotency', async () => {
  const w = await setup();
  try {
    const file = 'templates/tech_spec_validate.md';
    await writeFile(path.join(w.root, file), '# Previously shipped review');
    await writeWorkflowBaseline(w.root, await workflowFiles(w.root));
    const before = await workflowFiles(w.root);
    expect((await w.updater.update('mono-spec')).files.find(f => f.path === file)?.status).toBe('update');
    expect(await workflowFiles(w.root)).toEqual(before);
    const result = await w.updater.update('mono-spec', { apply: true }); expect(result.applied).toBe(true);
    expect(await readFile(path.join(result.backupPath!, 'before', file), 'utf8')).toBe('# Previously shipped review');
    expect(await workflowFiles(w.root)).toEqual(await workflowFiles(w.source));
    expect((await w.updater.update('mono-spec', { apply: true })).backupPath).toBeUndefined();
  } finally { await w.cleanup(); }
});
it('preserves legacy/custom files unless each conflicting path is explicitly accepted', async () => {
  const w = await setup();
  try {
    const file = 'templates/tech_spec_validate.md'; await writeFile(path.join(w.root, file), '# My policy');
    const preview = await w.updater.update('mono-spec'); expect(preview.conflicts).toEqual([file]);
    await expect(w.updater.update('mono-spec', { apply: true })).rejects.toThrow('explicit');
    expect(await readFile(path.join(w.root, file), 'utf8')).toBe('# My policy');
    await expect(readFile(path.join(w.root, BASELINE_FILE))).rejects.toThrow();
    await w.updater.update('mono-spec', { apply: true, acceptCustomized: [file] });
    expect(await workflowFiles(w.root)).toEqual(await workflowFiles(w.source));
  } finally { await w.cleanup(); }
});
it('blocks active tasks whose phase would disappear before any runtime writes', async () => {
  const w = await setup();
  try {
    const task = await w.store.createTask({ id: 'task', title: 'Task', workflow: 'mono-spec' }); task.currentPhase = 'custom_phase'; await w.store.saveTask(task);
    await writeFile(path.join(w.root, 'templates/tech_spec_validate.md'), '# Old'); await writeWorkflowBaseline(w.root, await workflowFiles(w.root));
    const before = await workflowFiles(w.root);
    await expect(w.updater.update('mono-spec', { apply: true })).rejects.toThrow('active phase');
    expect(await workflowFiles(w.root)).toEqual(before);
  } finally { await w.cleanup(); }
});
it('rejects escaping workflow asset symlinks during preview', async () => {
  const w = await setup();
  try {
    const { symlink } = await import('node:fs/promises'); await symlink('/etc/hosts', path.join(w.root, 'templates/external.md'));
    await expect(w.updater.update('mono-spec')).rejects.toThrow('symlinks');
  } finally { await w.cleanup(); }
});
it('updates selected validation assets while preserving unrelated customized prompts', async () => {
  const w = await setup();
  try {
    const file = 'templates/tech_spec_validate.md';
    await writeFile(path.join(w.root, file), '# Old validation');
    await writeFile(path.join(w.root, 'templates/tech_spec_draft.md'), '# Keep local author policy');
    await w.updater.update('mono-spec', { apply: true, files: [file], acceptCustomized: [file] });
    expect(await readFile(path.join(w.root, 'templates/tech_spec_draft.md'), 'utf8')).toBe('# Keep local author policy');
    expect((await w.updater.update('mono-spec')).conflicts).toEqual(['templates/tech_spec_draft.md']);
  } finally { await w.cleanup(); }
});
it('records a baseline for new preset installs and subsequently recognizes local customizations', async () => {
  const w = await auditWorkspace();
  try {
    const { PresetManager } = await import('#preset/preset-manager.js');
    await new PresetManager().initWorkspace(w.dir, 'default', { workflowInstall: 'project' });
    const updater = new WorkflowUpdater(w.dir);
    expect((await updater.update('mono-spec')).conflicts).toEqual([]);
    const root = path.join(new WorkflowRegistry(w.dir).getProjectRoot(), 'mono-spec');
    expect(JSON.parse(await readFile(path.join(root, BASELINE_FILE), 'utf8')).version).toBe(1);
    await writeFile(path.join(root, 'templates/tech_spec_validate.md'), '# Project-specific review');
    await expect(updater.update('mono-spec', { apply: true })).rejects.toThrow('explicit');
    expect(await readFile(path.join(root, 'templates/tech_spec_validate.md'), 'utf8')).toBe('# Project-specific review');
  } finally { await w.cleanup(); }
});
