import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { stringify } from 'yaml';
import { createTempWorkspace } from './createTempWorkspace.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import type { WorkflowDefinition } from '#core/types.js';

export async function auditWorkspace() {
  const workspace = await createTempWorkspace();
  await execa('git', ['init', '-q'], { cwd: workspace.dir });
  const workflowRoot = path.join(workspace.dir, '.playspec/workflows/audit');
  await mkdir(path.join(workflowRoot, 'templates'), { recursive: true });
  await writeFile(path.join(workflowRoot, 'templates/step.md'), '# {{TASK_TITLE}}\n');
  const definition: WorkflowDefinition = {
    id: 'audit', mode: 'linear', phaseOrder: ['a', 'b', 'c'],
    phases: Object.fromEntries(['a', 'b', 'c'].map(id => [id, { title: id, template: 'step.md' }])),
  };
  async function writeWorkflow(value: WorkflowDefinition = definition) {
    await writeFile(path.join(workflowRoot, 'workflow.yaml'), stringify(value));
  }
  await writeWorkflow();
  const store = new YamlTaskStore(workspace.dir);
  const core = new PlaySpecCore(workspace.dir, store);
  return { ...workspace, workflowRoot, definition, writeWorkflow, store, core };
}
