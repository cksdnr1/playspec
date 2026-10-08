import { it, expect } from 'vitest';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TemplateRenderer } from '#template/template-renderer.js';
import { resolveContainedPath } from '#utils/contained-path.js';
import { auditWorkspace } from '../helpers/auditWorkspace.js';

it('rejects external context symlinks both on registration and on completion', async () => {
  const w = await auditWorkspace();
  try {
    const outside = path.join(w.dir, 'external'); const inside = path.join(w.dir, 'workspace');
    await mkdir(inside); await writeFile(outside, 'private'); await symlink(outside, path.join(inside, 'link'));
    await expect(resolveContainedPath(inside, 'link')).rejects.toThrow(/outside/);
    // A selected template root has its own narrower read boundary.
    await symlink(outside, path.join(w.workflowRoot, 'templates/link.md'));
    await writeFile(path.join(w.workflowRoot, 'templates/step.md'), '{{include:link.md}}');
    await expect(new TemplateRenderer(w.dir).render('step.md', {}, path.join(w.workflowRoot, 'templates'))).rejects.toThrow(/escapes/i);
    await symlink(outside, path.join(w.workflowRoot, 'templates/main-link.md'));
    await expect(new TemplateRenderer(w.dir).render('main-link.md', {}, path.join(w.workflowRoot, 'templates'))).rejects.toThrow(/escapes/i);
    const contextLink = path.join(w.dir, 'outside-link'); await symlink(path.join(w.dir, '..'), contextLink);
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit', contextRefs: [{ path: 'outside-link/file', role: 'planning-context', source: 'manual' }] });
    await expect(w.core.addContextRef('task', 'outside-link/file')).rejects.toThrow(/escapes/);
    await expect(w.core.completePhase('task')).rejects.toThrow(/context/i);
  } finally { await w.cleanup(); }
});

it('allows internal symlinks, canonical workspace roots and missing descendants', async () => {
  const w = await auditWorkspace();
  try {
    await writeFile(path.join(w.dir, 'context.md'), 'safe'); await symlink(path.join(w.dir, 'context.md'), path.join(w.dir, 'link.md'));
    expect(await resolveContainedPath(w.dir, 'link.md')).toBe(await resolveContainedPath(w.dir, 'context.md'));
    expect(await resolveContainedPath(w.dir, 'new/deep/file')).toContain('new/deep/file');
    const rootLink = path.join(w.dir, 'root-link'); await symlink(w.dir, rootLink);
    expect(await resolveContainedPath(rootLink, 'context.md')).toBe(await resolveContainedPath(w.dir, 'context.md'));
    await w.store.createTask({ id: 'task', title: 'Task', workflow: 'audit' });
    expect(await w.core.addContextRef('task', 'link.md')).toBe(true);
    expect(await w.core.renderNextPrompt('task', { contextMode: 'full' })).toContain('safe');
    await symlink(path.join(w.dir, 'missing'), path.join(w.dir, 'dangling'));
    await expect(resolveContainedPath(w.dir, 'dangling/file')).rejects.toThrow(/dangling/);
  } finally { await w.cleanup(); }
});
