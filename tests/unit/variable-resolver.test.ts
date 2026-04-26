import { describe, it, expect } from 'vitest';
import { VariableResolver } from '#template/variable-resolver.js';
import type { PhaseDefinition, TaskRecord } from '#core/types.js';

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
    expect(vars.STEP_NUMBER).toBe('1');
    expect(vars.STEP_ID).toBe('1');
    expect(vars.STEP_TITLE).toBe('1');
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

  it('resolves mono-spec standard file variables', () => {
    const monoTask: TaskRecord = { ...baseTask, workflowType: 'mono-spec' };
    const vars = resolver.resolve(monoTask, 'safe_refactor');
    expect(vars.TARGET_BRANCH).toBe('origin/master');
    expect(vars.SOURCE_PROBLEM_FILE).toBe('(not provided)');
    expect(vars.CONTEXT_FILES).toBe('(none)');
    expect(vars.CONTEXT_REFS_DETAIL).toBe('(none)');
    expect(vars.SPEC_FILE).toBe('docs/features/feature_name/spec.md');
    expect(vars.PLAN_FILE).toBe('docs/features/feature_name/plan.md');
    expect(vars.RESULT_FILE).toBe('docs/features/feature_name/result.md');
    expect(vars.PR_FILE).toBe('docs/features/feature_name/pr.md');
    expect(vars.IMPLEMENTATION_PLAN_FILE).toBe('docs/features/feature_name/plan.md');
    expect(vars.IMPLEMENTATION_RESULT_FILE).toBe('docs/features/feature_name/result.md');
    expect(vars.TEST_RESULT_FILE).toBe('docs/features/feature_name/result.md');
    expect(vars.PR_BODY_FILE).toBe('docs/features/feature_name/pr.md');
  });

  it('keeps legacy phase-based file variables available for non-mono workflows', () => {
    const vars = resolver.resolve(baseTask, 'safe_refactor');
    expect(vars.MASTER_SPEC_FILE).toBe('docs/features/feature_name/feature_name_master_spec.md');
    expect(vars.MASTER_PHASE_FILE).toBe('docs/features/feature_name/feature_name_phase_plan.md');
    expect(vars.IMPLEMENTATION_PLAN_FILE).toBe(
      'docs/features/feature_name/feature_name_implementation_plan.md'
    );
    expect(vars.IMPLEMENTATION_RESULT_FILE).toBe(
      'docs/features/feature_name/feature_name_implementation_result.md'
    );
    expect(vars.TEST_RESULT_FILE).toBe('docs/features/feature_name/feature_name_test_result.md');
    expect(vars.PR_BODY_FILE).toBe('docs/features/feature_name/feature_name_pr_body.md');
  });

  it('uses mono-spec step metadata without changing stable document files', () => {
    const monoTask: TaskRecord = { ...baseTask, workflowType: 'mono-spec' };
    const definition: PhaseDefinition = {
      title: '기술 명세서 업데이트',
      stepNumber: '3',
      stepTitle: '기술 명세서 업데이트',
      template: 'mono-spec/tech_spec_patch.md',
    };

    const vars = resolver.resolve(monoTask, 'tech_spec_patch', definition);

    expect(vars.PHASE_NUMBER).toBe('3');
    expect(vars.STEP_NUMBER).toBe('3');
    expect(vars.STEP_ID).toBe('tech_spec_patch');
    expect(vars.STEP_TITLE).toBe('기술 명세서 업데이트');
    expect(vars.SPEC_FILE).toBe('docs/features/feature_name/spec.md');
    expect(vars.PLAN_FILE).toBe('docs/features/feature_name/plan.md');
    expect(vars.RESULT_FILE).toBe('docs/features/feature_name/result.md');
    expect(vars.PR_FILE).toBe('docs/features/feature_name/pr.md');
  });

  it('uses stable mono-spec files across implementation and review steps', () => {
    const monoTask: TaskRecord = { ...baseTask, workflowType: 'mono-spec' };
    const definition: PhaseDefinition = {
      title: '구현 계획서 업데이트',
      stepNumber: '6',
      stepTitle: '구현 계획서 업데이트',
      template: 'mono-spec/implementation_plan_patch.md',
    };

    const vars = resolver.resolve(monoTask, 'implementation_plan_patch', definition);

    expect(vars.IMPLEMENTATION_PLAN_FILE).toBe(
      'docs/features/feature_name/plan.md'
    );
    expect(vars.IMPLEMENTATION_RESULT_FILE).toBe(
      'docs/features/feature_name/result.md'
    );
    expect(vars.TEST_RESULT_FILE).toBe(
      'docs/features/feature_name/result.md'
    );
    expect(vars.PR_BODY_FILE).toBe(
      'docs/features/feature_name/pr.md'
    );
  });

  it('uses a source-problem context ref as SOURCE_PROBLEM_FILE', () => {
    const task: TaskRecord = {
      ...baseTask,
      contextRefs: [
        { path: 'docs/features/feature_name/notes.md', role: 'planning-context', source: 'manual' },
        { path: 'docs/features/feature_name/problem.md', role: 'source-problem', source: 'manual' },
      ],
    };

    const vars = resolver.resolve(task, '1');

    expect(vars.SOURCE_PROBLEM_FILE).toBe('docs/features/feature_name/problem.md');
    expect(vars.CONTEXT_FILES).toContain('- `docs/features/feature_name/notes.md`');
    expect(vars.CONTEXT_FILES).toContain('- `docs/features/feature_name/problem.md`');
    expect(vars.CONTEXT_REFS_DETAIL).toContain(
      '- `docs/features/feature_name/problem.md` (role: source-problem, source: manual)'
    );
  });

  it('uses a stdin context ref when there is no source-problem ref', () => {
    const task: TaskRecord = {
      ...baseTask,
      contextRefs: [
        { path: 'docs/features/feature_name/manual.md', role: 'planning-context', source: 'manual' },
        { path: '.playspec/tasks/active/feature_name/sources/source_problem.md', role: 'planning-context', source: 'stdin' },
      ],
    };

    const vars = resolver.resolve(task, '1');

    expect(vars.SOURCE_PROBLEM_FILE).toBe(
      '.playspec/tasks/active/feature_name/sources/source_problem.md'
    );
  });

  it('uses the only context ref as SOURCE_PROBLEM_FILE', () => {
    const task: TaskRecord = {
      ...baseTask,
      contextRefs: [
        { path: 'cross_project_cli_import_alias_bug.md', role: 'planning-context', source: 'manual' },
      ],
    };

    const vars = resolver.resolve(task, '1');

    expect(vars.SOURCE_PROBLEM_FILE).toBe('cross_project_cli_import_alias_bug.md');
    expect(vars.CONTEXT_FILES).toBe('- `cross_project_cli_import_alias_bug.md`');
    expect(vars.CONTEXT_REFS_DETAIL).toBe(
      '- `cross_project_cli_import_alias_bug.md` (role: planning-context, source: manual)'
    );
  });

  it('does not choose a source file silently when multiple context refs have no priority match', () => {
    const task: TaskRecord = {
      ...baseTask,
      contextRefs: [
        { path: 'docs/features/feature_name/a.md', role: 'planning-context', source: 'manual' },
        { path: 'docs/features/feature_name/b.md', role: 'planning-context', source: 'manual' },
      ],
    };

    const vars = resolver.resolve(task, '1');

    expect(vars.SOURCE_PROBLEM_FILE).toBe('(multiple context refs)');
    expect(vars.CONTEXT_FILES).toBe(
      '- `docs/features/feature_name/a.md`\n- `docs/features/feature_name/b.md`'
    );
  });
});
