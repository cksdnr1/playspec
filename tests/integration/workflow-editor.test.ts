import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { WorkflowEditor } from '#workflow/workflow-editor.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PresetManager } from '#preset/preset-manager.js';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';

let workspace: TempWorkspace;
let previousUserWorkflows: string | undefined;

beforeEach(async () => {
  workspace = await createTempWorkspace();
  previousUserWorkflows = process.env['PLAY_SPEC_USER_WORKFLOWS'];
  process.env['PLAY_SPEC_USER_WORKFLOWS'] = path.join(workspace.dir, 'user-workflows');
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');
});

afterEach(async () => {
  if (previousUserWorkflows === undefined) {
    delete process.env['PLAY_SPEC_USER_WORKFLOWS'];
  } else {
    process.env['PLAY_SPEC_USER_WORKFLOWS'] = previousUserWorkflows;
  }
  await workspace.cleanup();
});

describe('WorkflowEditor', () => {
  it('adds a phase and writes backup and report files', async () => {
    await writeProjectWorkflow('editable');

    const result = await new WorkflowEditor(workspace.dir).addPhase({
      workflowId: 'editable',
      afterPhaseId: 'start',
      newPhaseId: 'review',
      title: 'Review',
      templatePath: 'review.md',
    });

    const workflow = await new WorkflowLoader(workspace.dir).load('editable');
    expect(workflow.phaseOrder).toEqual(['start', 'review', 'done']);
    expect(workflow.phases['review']).toMatchObject({ title: 'Review', template: 'review.md' });
    await expect(readWorkspaceFile(result.backupPath)).resolves.toContain('phaseOrder:');
    const report = parseYaml(await readWorkspaceFile(result.reportPath)) as { command: string; afterPhaseIds: string[] };
    expect(report.command).toBe('add-phase');
    expect(report.afterPhaseIds).toEqual(['start', 'review', 'done']);
  });

  it('rejects duplicate phase IDs before backup or report creation', async () => {
    await writeProjectWorkflow('editable');

    await expect(new WorkflowEditor(workspace.dir).addPhase({
      workflowId: 'editable',
      afterPhaseId: 'start',
      newPhaseId: 'done',
      title: 'Duplicate',
      templatePath: 'review.md',
    })).rejects.toThrow('already has phase');

    expect(await listReportFiles()).toEqual([]);
    expect(await listBackupDirs()).toEqual([]);
  });

  it('rejects missing template paths before backup or report creation', async () => {
    await writeProjectWorkflow('editable');

    await expect(new WorkflowEditor(workspace.dir).setTemplate({
      workflowId: 'editable',
      phaseId: 'start',
      templatePath: 'missing.md',
    })).rejects.toThrow('template not found');

    expect(await listReportFiles()).toEqual([]);
    expect(await listBackupDirs()).toEqual([]);
  });

  it('removes a non-current phase and records replacement only in the report', async () => {
    await writeProjectWorkflow('editable');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'task_on_editable', title: 'Task On Editable', workflow: 'editable' });
    await store.updateTask('task_on_editable', { currentPhase: 'start' });

    const result = await new WorkflowEditor(workspace.dir).removePhase({
      workflowId: 'editable',
      phaseId: 'done',
      replacement: 'start',
    });

    const workflow = await new WorkflowLoader(workspace.dir).load('editable');
    expect(workflow.phaseOrder).toEqual(['start']);
    const task = await store.getTask('task_on_editable');
    expect(task.currentPhase).toBe('start');
    const report = parseYaml(await readWorkspaceFile(result.reportPath)) as { replacement: string };
    expect(report.replacement).toBe('start');
  });

  it('rejects removing an active current phase even with a replacement', async () => {
    await writeProjectWorkflow('editable');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'task_on_done', title: 'Task On Done', workflow: 'editable' });
    await store.updateTask('task_on_done', { currentPhase: 'done' });

    await expect(new WorkflowEditor(workspace.dir).removePhase({
      workflowId: 'editable',
      phaseId: 'done',
      replacement: 'start',
    })).rejects.toThrow('would orphan active task current phase');

    const workflow = await new WorkflowLoader(workspace.dir).load('editable');
    expect(workflow.phaseOrder).toEqual(['start', 'done']);
    expect(await listReportFiles()).toEqual([]);
    expect(await listBackupDirs()).toEqual([]);
  });

  it('reorders phases while preserving the same phase IDs', async () => {
    await writeProjectWorkflow('editable');

    await new WorkflowEditor(workspace.dir).reorderPhase({
      workflowId: 'editable',
      phaseId: 'start',
      afterPhaseId: 'done',
    });

    const workflow = await new WorkflowLoader(workspace.dir).load('editable');
    expect(workflow.phaseOrder).toEqual(['done', 'start']);
    expect(Object.keys(workflow.phases).sort()).toEqual(['done', 'start']);
  });

  it('sets a phase template to an existing template path', async () => {
    await writeProjectWorkflow('editable');

    await new WorkflowEditor(workspace.dir).setTemplate({
      workflowId: 'editable',
      phaseId: 'done',
      templatePath: 'review.md',
    });

    const workflow = await new WorkflowLoader(workspace.dir).load('editable');
    expect(workflow.phases['done']?.template).toBe('review.md');
  });

  it('rejects built-in preset workflow assets as read-only', async () => {
    await rm(path.join(workspace.dir, '.playspec', 'workflows', 'mono-spec'), { recursive: true, force: true });

    await expect(new WorkflowEditor(workspace.dir).addPhase({
      workflowId: 'mono-spec',
      afterPhaseId: 'tech_spec_draft',
      newPhaseId: 'extra',
      title: 'Extra',
      templatePath: 'phase_template.md',
    })).rejects.toThrow('read-only');
  });
});

async function writeProjectWorkflow(id: string): Promise<void> {
  const workflowRoot = path.join(workspace.dir, '.playspec', 'workflows', id);
  await mkdir(path.join(workflowRoot, 'templates'), { recursive: true });
  await writeFile(
    path.join(workflowRoot, 'workflow.yaml'),
    `id: ${id}
name: Editable
mode: linear
phaseOrder:
  - start
  - done
phases:
  start:
    title: Start
    template: start.md
  done:
    title: Done
    template: done.md
`,
    'utf8'
  );
  await writeFile(path.join(workflowRoot, 'templates', 'start.md'), '# Start\n', 'utf8');
  await writeFile(path.join(workflowRoot, 'templates', 'done.md'), '# Done\n', 'utf8');
  await writeFile(path.join(workflowRoot, 'templates', 'review.md'), '# Review\n', 'utf8');
}

async function readWorkspaceFile(relativePath: string): Promise<string> {
  return readFile(path.join(workspace.dir, relativePath), 'utf8');
}

async function listReportFiles(): Promise<string[]> {
  try {
    return await readdir(path.join(workspace.dir, '.playspec', 'workflows', '.reports'));
  } catch {
    return [];
  }
}

async function listBackupDirs(): Promise<string[]> {
  try {
    return await readdir(path.join(workspace.dir, '.playspec', 'workflows', '.backups'));
  } catch {
    return [];
  }
}
