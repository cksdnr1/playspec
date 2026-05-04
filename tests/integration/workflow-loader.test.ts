import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import { WorkflowNotFoundError } from '#core/errors.js';
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

describe('WorkflowLoader', () => {
  async function writeWorkflow(root: string, id: string, description: string): Promise<void> {
    await mkdir(path.join(root, id, 'templates'), { recursive: true });
    await writeFile(
      path.join(root, id, 'workflow.yaml'),
      `id: ${id}
description: ${description}
mode: linear
phaseOrder:
  - start
phases:
  start:
    title: Start
    template: start.md
`,
      'utf8'
    );
    await writeFile(path.join(root, id, 'templates', 'start.md'), '# {{TASK_TITLE}}\n', 'utf8');
  }

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

  it('loads mono-spec workflow with validation gates and required variables', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    const workflow = await loader.load('mono-spec');

    expect(workflow.id).toBe('mono-spec');
    expect(workflow.phaseOrder).toEqual([
      'tech_spec_draft',
      'tech_spec_validate',
      'tech_spec_patch',
      'implementation_plan_create',
      'implementation_plan_validate',
      'implementation_plan_patch',
      'implementation',
      'focused_tests',
      'safe_refactor',
      'pr_prepare',
    ]);
    expect(workflow.phaseOrder.map((phaseId) => workflow.phases[phaseId]?.stepNumber)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    expect(workflow.phases['tech_spec_patch']?.stepTitle).toBe('기술 명세서 업데이트');
    expect(workflow.phases['tech_spec_patch']?.gate).toBeUndefined();
    expect(workflow.phases['tech_spec_patch']?.next).toBe('tech_spec_validate');
    expect(workflow.phases['tech_spec_validate']?.gate?.nextByResult).toEqual({
      approved: 'implementation_plan_create',
      needs_revision: 'tech_spec_patch',
    });
    expect(workflow.phases['implementation_plan_patch']?.stepTitle).toBe('구현 계획서 업데이트');
    expect(workflow.phases['implementation_plan_patch']?.gate).toBeUndefined();
    expect(workflow.phases['implementation_plan_patch']?.next).toBe('implementation_plan_validate');
    expect(workflow.phases['implementation_plan_validate']?.gate?.nextByResult).toEqual({
      approved: 'implementation',
      needs_revision: 'implementation_plan_patch',
    });
    expect(workflow.phases['safe_refactor']?.requiredVariables).toContain('TARGET_BRANCH');
    expect(workflow.phases['pr_prepare']?.requiredVariables).toContain('TARGET_BRANCH');

    const monoRequiredVariables = workflow.phaseOrder.flatMap(
      (phaseId) => workflow.phases[phaseId]?.requiredVariables ?? []
    );
    expect(monoRequiredVariables).toEqual(expect.arrayContaining([
      'SPEC_FILE',
      'PLAN_FILE',
      'RESULT_FILE',
      'PR_FILE',
    ]));
    expect(monoRequiredVariables).not.toContain('MASTER_SPEC_FILE');
    expect(monoRequiredVariables).not.toContain('MASTER_PHASE_FILE');
    expect(monoRequiredVariables).not.toContain('PHASE_SPEC_FILE');
    expect(monoRequiredVariables).not.toContain('PHASE_HANDOFF_FILE');
  });

  it('loads total-plan workflow with planning gates and phase-execution-compatible outputs', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    const workflow = await loader.load('total-plan');

    expect(workflow.id).toBe('total-plan');
    expect(workflow.phaseOrder).toEqual([
      'total_spec_draft',
      'total_spec_validate',
      'total_spec_patch',
      'phase_plan_create',
      'phase_plan_validate',
      'phase_plan_patch',
      'final_review',
    ]);
    expect(workflow.phases['total_spec_validate']?.gate?.nextByResult).toEqual({
      approved: 'phase_plan_create',
      needs_revision: 'total_spec_patch',
    });
    expect(workflow.phases['phase_plan_validate']?.gate?.nextByResult).toEqual({
      approved: 'final_review',
      needs_revision: 'phase_plan_patch',
    });
    expect(workflow.phases['total_spec_patch']?.next).toBe('total_spec_validate');
    expect(workflow.phases['phase_plan_patch']?.next).toBe('phase_plan_validate');
    expect(workflow.phases['final_review']?.next).toBeNull();
    expect(workflow.phases['total_spec_draft']?.outputs).toEqual(['{{TOTAL_SPEC_FILE}}']);
    expect(workflow.phases['phase_plan_create']?.outputs).toEqual(['{{PHASE_PLAN_FILE}}']);

    const requiredVariables = workflow.phaseOrder.flatMap(
      (phaseId) => workflow.phases[phaseId]?.requiredVariables ?? []
    );
    expect(requiredVariables).toContain('TOTAL_SPEC_FILE');
    expect(requiredVariables).toContain('PHASE_PLAN_FILE');
  });

  it('throws WorkflowNotFoundError for unknown workflow', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    await expect(loader.load('nonexistent-workflow')).rejects.toThrow(WorkflowNotFoundError);
  });

  it('resolves project workflows before user and builtin workflows', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeWorkflow(registry.getUserRoot(), 'mono-spec', 'User override');
    await writeWorkflow(registry.getProjectRoot(), 'mono-spec', 'Project override');

    const workflow = await new WorkflowLoader(workspace.dir).resolve('mono-spec');

    expect(workflow.source).toBe('project');
    expect(workflow.definition.description).toBe('Project override');
  });

  it('resolves user workflows before builtin when project workflow is absent', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await rm(path.join(registry.getProjectRoot(), 'mono-spec'), { recursive: true, force: true });
    await writeWorkflow(registry.getUserRoot(), 'mono-spec', 'User override');

    const workflow = await new WorkflowLoader(workspace.dir).resolve('mono-spec');

    expect(workflow.source).toBe('user');
    expect(workflow.definition.description).toBe('User override');
  });

  it('lists effective workflows once, grouped by source priority then id', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeWorkflow(registry.getUserRoot(), 'mono-spec', 'User duplicate');
    await writeWorkflow(registry.getUserRoot(), 'aaa-user-only', 'User only');
    await writeWorkflow(registry.getProjectRoot(), 'zzz-project-only', 'Project only');

    const locations = await registry.list();
    const monoSpecLocations = locations.filter((location) => location.id === 'mono-spec');
    const projectIndexes = locations
      .map((location, index) => [location.source, index] as const)
      .filter(([source]) => source === 'project')
      .map(([, index]) => index);
    const userOnlyIndex = locations.findIndex((location) => location.id === 'aaa-user-only');

    expect(monoSpecLocations).toHaveLength(1);
    expect(monoSpecLocations[0]?.source).toBe('project');
    expect(projectIndexes.every((index) => index < userOnlyIndex)).toBe(true);
    expect(locations.filter((location) => location.source === 'project').map((location) => location.id)).toEqual(
      [...locations.filter((location) => location.source === 'project').map((location) => location.id)].sort()
    );
  });
});
