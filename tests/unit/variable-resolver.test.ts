import { describe, it, expect } from 'vitest';
import { VariableResolver } from '../../src/template/variable-resolver.js';
import type { TaskRecord } from '../../src/core/types.js';

const baseTask: TaskRecord = {
  id: 'feature_name',
  title: 'Feature Name',
  workflowType: 'multi-spec',
  status: 'active',
  workflowMode: 'linear',
  currentPhase: null,
  createdAt: '2026-04-24T10:00:00Z',
  updatedAt: '2026-04-24T10:00:00Z',
  paths: {
    taskRoot: '.playspec/tasks/active/feature_name',
    projectDocRoot: 'docs/features/feature_name',
  },
  variables: {
    FEATURE_SLUG: 'feature_name',
  },
  phaseHistory: [],
};

describe('VariableResolver', () => {
  const resolver = new VariableResolver();

  it('resolves standard variables', () => {
    const vars = resolver.resolve(baseTask, '1');
    expect(vars.FEATURE_SLUG).toBe('feature_name');
    expect(vars.PHASE_NUMBER).toBe('1');
    expect(vars.TASK_ID).toBe('feature_name');
    expect(vars.TASK_TITLE).toBe('Feature Name');
    expect(vars.WORKFLOW_TYPE).toBe('multi-spec');
  });

  it('derives PHASE_SPEC_FILE correctly', () => {
    const vars = resolver.resolve(baseTask, '3');
    expect(vars.PHASE_SPEC_FILE).toBe(
      'docs/feature_name/feature_name_phase3_implementation_spec.md'
    );
  });

  it('derives PHASE_HANDOFF_FILE correctly', () => {
    const vars = resolver.resolve(baseTask, '3');
    expect(vars.PHASE_HANDOFF_FILE).toBe(
      'docs/feature_name/feature_name_phase3_handoff.md'
    );
  });

  it('falls back to slugified title if FEATURE_SLUG not in variables', () => {
    const task: TaskRecord = { ...baseTask, variables: {} };
    const vars = resolver.resolve(task, '1');
    expect(vars.FEATURE_SLUG).toBe('feature_name');
  });
});
