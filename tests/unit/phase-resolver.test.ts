import { describe, it, expect } from 'vitest';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { PhaseNotFoundError } from '#core/errors.js';
import type { TaskRecord, WorkflowDefinition } from '#core/types.js';

const workflow: WorkflowDefinition = {
  id: 'multi-spec',
  mode: 'linear',
  phaseOrder: ['1', '2', '3'],
  phases: {
    '1': { title: 'Phase 1', template: 'multi-spec/phase_template.md' },
    '2': { title: 'Phase 2', template: 'multi-spec/phase_template.md' },
    '3': { title: 'Phase 3', template: 'multi-spec/phase_template.md' },
  },
};

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
  variables: {},
  phaseHistory: [],
};

describe('PhaseResolver', () => {
  const resolver = new PhaseResolver();

  describe('resolveNextPhase', () => {
    it('returns first phase when currentPhase is null', () => {
      const result = resolver.resolveNextPhase(baseTask, workflow);
      expect(result.phaseId).toBe('1');
      expect(result.definition.title).toBe('Phase 1');
    });

    it('returns second phase when currentPhase is 1', () => {
      const task = { ...baseTask, currentPhase: '1' };
      const result = resolver.resolveNextPhase(task, workflow);
      expect(result.phaseId).toBe('2');
    });

    it('returns third phase when currentPhase is 2', () => {
      const task = { ...baseTask, currentPhase: '2' };
      const result = resolver.resolveNextPhase(task, workflow);
      expect(result.phaseId).toBe('3');
    });

    it('throws PhaseNotFoundError when at last phase', () => {
      const task = { ...baseTask, currentPhase: '3' };
      expect(() => resolver.resolveNextPhase(task, workflow)).toThrow(
        PhaseNotFoundError
      );
    });
  });

  describe('resolveExplicitPhase', () => {
    it('resolves a valid phase ID', () => {
      const result = resolver.resolveExplicitPhase('2', workflow);
      expect(result.phaseId).toBe('2');
      expect(result.definition.title).toBe('Phase 2');
    });

    it('throws PhaseNotFoundError for unknown phase ID', () => {
      expect(() => resolver.resolveExplicitPhase('99', workflow)).toThrow(
        PhaseNotFoundError
      );
    });
  });
});
