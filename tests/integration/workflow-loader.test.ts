import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { WorkflowNotFoundError } from '#core/errors.js';
import { PresetManager } from '#preset/preset-manager.js';
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

  it('throws WorkflowNotFoundError for unknown workflow type', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    await expect(loader.load('nonexistent-workflow')).rejects.toThrow(WorkflowNotFoundError);
  });
});
