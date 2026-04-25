import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkflowLoader } from '../../src/workflow/workflow-loader.js';
import { WorkflowNotFoundError } from '../../src/core/errors.js';
import { PresetManager } from '../../src/preset/preset-manager.js';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');
});

afterEach(async () => {
  await workspace.cleanup();
});

describe('WorkflowLoader', () => {
  it('loads multi-spec workflow with expected fields', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    const workflow = await loader.load('multi-spec');

    expect(workflow.id).toBe('multi-spec');
    expect(workflow.mode).toBe('linear');
    expect(Array.isArray(workflow.phaseOrder)).toBe(true);
    expect(workflow.phaseOrder.length).toBeGreaterThan(0);
    expect(typeof workflow.phases).toBe('object');
  });

  it('loaded workflow phases match phaseOrder keys', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    const workflow = await loader.load('multi-spec');

    for (const phaseId of workflow.phaseOrder) {
      expect(workflow.phases[phaseId]).toBeDefined();
      expect(workflow.phases[phaseId].title).toBeTruthy();
      expect(workflow.phases[phaseId].template).toBeTruthy();
    }
  });

  it('throws WorkflowNotFoundError for unknown workflow type', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    await expect(loader.load('nonexistent-workflow')).rejects.toThrow(WorkflowNotFoundError);
  });
});
