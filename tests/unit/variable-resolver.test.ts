import { describe, it, expect } from 'vitest';
import { VariableResolver } from '#template/variable-resolver.js';
import {
  CircularVariableDefaultError,
  UnknownVariableDefaultError,
} from '#core/errors.js';
import type { PhaseDefinition, TaskRecord, WorkflowDefinition } from '#core/types.js';

const baseTask: TaskRecord = {
  id: 'feature_name',
  title: 'Feature Name',
  workflow: 'multi-spec',
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

const multiWorkflow: WorkflowDefinition = {
  id: 'multi-spec',
  mode: 'linear',
  phaseOrder: ['1', '2', '3'],
  variables: {
    FEATURE_SLUG: { required: true },
    PHASE_SPEC_FILE: {
      default: 'docs/{{FEATURE_SLUG}}/{{FEATURE_SLUG}}_phase{{PHASE_NUMBER}}_implementation_spec.md',
    },
    PHASE_HANDOFF_FILE: {
      default: 'docs/{{FEATURE_SLUG}}/{{FEATURE_SLUG}}_phase{{PHASE_NUMBER}}_handoff.md',
    },
  },
  phases: {
    '1': { title: 'Phase 1', template: 'phase_template.md' },
    '2': { title: 'Phase 2', template: 'phase_template.md' },
    '3': { title: 'Phase 3', template: 'phase_template.md' },
  },
};

const monoWorkflow: WorkflowDefinition = {
  id: 'mono-spec',
  mode: 'linear',
  phaseOrder: ['safe_refactor', 'tech_spec_patch', 'implementation_plan_patch'],
  variables: {
    FEATURE_SLUG: { required: true },
    TARGET_BRANCH: { default: 'origin/master' },
    SPEC_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/spec.md' },
    PLAN_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/plan.md' },
    RESULT_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/result.md' },
    PR_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/pr.md' },
    IMPLEMENTATION_PLAN_FILE: { default: '{{PLAN_FILE}}' },
    IMPLEMENTATION_RESULT_FILE: { default: '{{RESULT_FILE}}' },
    TEST_RESULT_FILE: { default: '{{RESULT_FILE}}' },
    PR_BODY_FILE: { default: '{{PR_FILE}}' },
  },
  phases: {
    safe_refactor: { title: 'Refactor', template: 'safe_refactor.md' },
    tech_spec_patch: {
      title: '기술 명세서 업데이트',
      stepNumber: '3',
      stepTitle: '기술 명세서 업데이트',
      template: 'tech_spec_patch.md',
    },
    implementation_plan_patch: {
      title: '구현 계획서 업데이트',
      stepNumber: '6',
      stepTitle: '구현 계획서 업데이트',
      template: 'implementation_plan_patch.md',
    },
  },
};

const totalPlanWorkflow: WorkflowDefinition = {
  id: 'total-plan',
  mode: 'linear',
  phaseOrder: ['total_spec_draft'],
  variables: {
    FEATURE_SLUG: { required: true },
    TOTAL_SPEC_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/{{FEATURE_SLUG}}_total_spec.md' },
    PHASE_PLAN_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/{{FEATURE_SLUG}}_phase_plan.md' },
  },
  phases: {
    total_spec_draft: { title: 'Total Spec Draft', template: 'total_spec_draft.md' },
  },
};

const issueScopeCreateWorkflow: WorkflowDefinition = {
  id: 'issue-scope-create',
  mode: 'linear',
  phaseOrder: ['scoped_issue_discovery', 'create_scoped_issues'],
  variables: {
    TARGET_REPOSITORY: { required: true },
    ISSUE_SCOPE: { required: true },
    FOCUS_AREA: { required: true },
    OUT_OF_SCOPE_RULES: { required: true },
    DUPLICATE_SEARCH_QUERY: { required: true },
    MAX_ISSUES: { default: '3' },
    ISSUE_LABEL: { default: 'agent-validation' },
    OUTPUT_DIR: { default: 'docs/issues/scope-create/{{TASK_ID}}' },
    DISCOVERY_FILE: { default: '{{OUTPUT_DIR}}/discovery.md' },
    CANDIDATE_ISSUES_FILE: { default: '{{OUTPUT_DIR}}/candidate_issues.md' },
    CREATED_ISSUES_FILE: { default: '{{OUTPUT_DIR}}/created_issues.md' },
  },
  phases: {
    scoped_issue_discovery: {
      title: 'Scoped issue discovery',
      template: 'scoped_issue_discovery.md',
    },
    create_scoped_issues: {
      title: 'Create scoped GitHub issues',
      template: 'create_scoped_issues.md',
    },
  },
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
    const vars = resolver.resolve(baseTask, '3', multiWorkflow, multiWorkflow.phases['3']);
    expect(vars.PHASE_SPEC_FILE).toBe(
      'docs/feature_name/feature_name_phase3_implementation_spec.md'
    );
  });

  it('derives PHASE_HANDOFF_FILE correctly', () => {
    const vars = resolver.resolve(baseTask, '3', multiWorkflow, multiWorkflow.phases['3']);
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
    const monoTask: TaskRecord = { ...baseTask, workflow: 'mono-spec' };
    const vars = resolver.resolve(monoTask, 'safe_refactor', monoWorkflow, monoWorkflow.phases.safe_refactor);
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

  it('resolves non-mono path variables from workflow declarations', () => {
    const vars = resolver.resolve(baseTask, '3', multiWorkflow, multiWorkflow.phases['3']);
    expect(vars.PHASE_SPEC_FILE).toBe('docs/feature_name/feature_name_phase3_implementation_spec.md');
    expect(vars.PHASE_HANDOFF_FILE).toBe('docs/feature_name/feature_name_phase3_handoff.md');
  });

  it('uses mono-spec step metadata without changing stable document files', () => {
    const monoTask: TaskRecord = { ...baseTask, workflow: 'mono-spec' };
    const definition: PhaseDefinition = {
      title: '기술 명세서 업데이트',
      stepNumber: '3',
      stepTitle: '기술 명세서 업데이트',
      template: 'mono-spec/tech_spec_patch.md',
    };

    const vars = resolver.resolve(monoTask, 'tech_spec_patch', monoWorkflow, definition);

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
    const monoTask: TaskRecord = { ...baseTask, workflow: 'mono-spec' };
    const definition: PhaseDefinition = {
      title: '구현 계획서 업데이트',
      stepNumber: '6',
      stepTitle: '구현 계획서 업데이트',
      template: 'mono-spec/implementation_plan_patch.md',
    };

    const vars = resolver.resolve(monoTask, 'implementation_plan_patch', monoWorkflow, definition);

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

  it('allows explicit total-plan output variable overrides', () => {
    const task: TaskRecord = {
      ...baseTask,
      variables: {
        FEATURE_SLUG: 'feature_name',
        TOTAL_SPEC_FILE: 'docs/custom/total.md',
        PHASE_PLAN_FILE: 'docs/custom/phases.md',
      },
    };

    const vars = resolver.resolve(task, 'total_spec_draft', totalPlanWorkflow, totalPlanWorkflow.phases.total_spec_draft);

    expect(vars.TOTAL_SPEC_FILE).toBe('docs/custom/total.md');
    expect(vars.PHASE_PLAN_FILE).toBe('docs/custom/phases.md');
  });

  it('resolves workflow defaults that reference task variables', () => {
    const workflow: WorkflowDefinition = {
      id: 'task-var-default',
      mode: 'linear',
      phaseOrder: ['start'],
      variables: {
        ISSUE_SCOPE: { required: true },
        OUTPUT_DIR: { default: 'docs/issues/{{ISSUE_SCOPE}}' },
      },
      phases: {
        start: { title: 'Start', template: 'start.md' },
      },
    };
    const task: TaskRecord = {
      ...baseTask,
      variables: {
        ...baseTask.variables,
        ISSUE_SCOPE: 'required-variable-validation',
      },
    };

    const vars = resolver.resolve(task, 'start', workflow, workflow.phases.start);

    expect(vars.OUTPUT_DIR).toBe('docs/issues/required-variable-validation');
  });

  it('uses a declaration default when a task variable is an empty string', () => {
    const workflow: WorkflowDefinition = {
      id: 'empty-task-var-default',
      mode: 'linear',
      phaseOrder: ['start'],
      variables: {
        REQUIRED_NAME: {
          required: true,
          default: 'workflow-default',
        },
      },
      phases: {
        start: { title: 'Start', template: 'start.md' },
      },
    };
    const task: TaskRecord = {
      ...baseTask,
      variables: {
        ...baseTask.variables,
        REQUIRED_NAME: '',
      },
    };

    const vars = resolver.resolve(task, 'start', workflow, workflow.phases.start);

    expect(vars.REQUIRED_NAME).toBe('workflow-default');
  });

  it('resolves issue-scope-create report paths under the task-specific default directory', () => {
    const task: TaskRecord = {
      ...baseTask,
      id: 'inventory_mapping_scope',
      title: 'Inventory Mapping Scope',
      workflow: 'issue-scope-create',
      variables: {
        TARGET_REPOSITORY: 'cksdnr1/playspec',
        ISSUE_SCOPE: 'inventory mapping correctness',
        FOCUS_AREA: 'inventory services',
        OUT_OF_SCOPE_RULES: 'Do not implement fixes.',
        DUPLICATE_SEARCH_QUERY: 'repo:cksdnr1/playspec inventory mapping',
      },
    };

    const vars = resolver.resolve(
      task,
      'scoped_issue_discovery',
      issueScopeCreateWorkflow,
      issueScopeCreateWorkflow.phases.scoped_issue_discovery
    );

    expect(vars.OUTPUT_DIR).toBe('docs/issues/scope-create/inventory_mapping_scope');
    expect(vars.DISCOVERY_FILE).toBe('docs/issues/scope-create/inventory_mapping_scope/discovery.md');
    expect(vars.CANDIDATE_ISSUES_FILE).toBe('docs/issues/scope-create/inventory_mapping_scope/candidate_issues.md');
    expect(vars.CREATED_ISSUES_FILE).toBe('docs/issues/scope-create/inventory_mapping_scope/created_issues.md');
  });

  it('keeps explicit issue-scope-create report path overrides', () => {
    const task: TaskRecord = {
      ...baseTask,
      id: 'inventory_mapping_scope',
      title: 'Inventory Mapping Scope',
      workflow: 'issue-scope-create',
      variables: {
        TARGET_REPOSITORY: 'cksdnr1/playspec',
        ISSUE_SCOPE: 'inventory mapping correctness',
        FOCUS_AREA: 'inventory services',
        OUT_OF_SCOPE_RULES: 'Do not implement fixes.',
        DUPLICATE_SEARCH_QUERY: 'repo:cksdnr1/playspec inventory mapping',
        OUTPUT_DIR: 'docs/issues/scope-create',
        DISCOVERY_FILE: 'tmp/custom/discovery.md',
        CANDIDATE_ISSUES_FILE: 'tmp/custom/candidates.md',
        CREATED_ISSUES_FILE: 'tmp/custom/created.md',
      },
    };

    const vars = resolver.resolve(
      task,
      'scoped_issue_discovery',
      issueScopeCreateWorkflow,
      issueScopeCreateWorkflow.phases.scoped_issue_discovery
    );

    expect(vars.OUTPUT_DIR).toBe('docs/issues/scope-create');
    expect(vars.DISCOVERY_FILE).toBe('tmp/custom/discovery.md');
    expect(vars.CANDIDATE_ISSUES_FILE).toBe('tmp/custom/candidates.md');
    expect(vars.CREATED_ISSUES_FILE).toBe('tmp/custom/created.md');
  });

  it('does not fail an active phase for an unused workflow default with an unavailable dependency', () => {
    const workflow: WorkflowDefinition = {
      id: 'unused-future-default',
      mode: 'linear',
      phaseOrder: ['start', 'future'],
      variables: {
        FEATURE_SLUG: { required: true },
        CURRENT_FILE: { default: 'docs/{{FEATURE_SLUG}}/current.md' },
        FUTURE_FILE: { default: 'docs/{{FUTURE_KEY}}/out.md' },
      },
      phases: {
        start: {
          title: 'Start',
          template: 'start.md',
          requiredVariables: ['FEATURE_SLUG'],
        },
        future: {
          title: 'Future',
          template: 'future.md',
          requiredVariables: ['FUTURE_FILE'],
        },
      },
    };

    const vars = resolver.resolve(baseTask, 'start', workflow, workflow.phases.start);

    expect(vars.FEATURE_SLUG).toBe('feature_name');
    expect(vars.CURRENT_FILE).toBe('docs/feature_name/current.md');
    expect(vars.FUTURE_FILE).toBeUndefined();
  });

  it('throws a clear error for unknown default references', () => {
    const workflow: WorkflowDefinition = {
      id: 'bad-default',
      mode: 'linear',
      phaseOrder: ['start'],
      variables: {
        BAD_FILE: { default: 'docs/{{UNKNOWN_SLUG}}/spec.md' },
      },
      phases: {
        start: {
          title: 'Start',
          template: 'start.md',
          requiredVariables: ['BAD_FILE'],
        },
      },
    };

    expect(() => resolver.resolve(baseTask, 'start', workflow, workflow.phases.start)).toThrow(
      UnknownVariableDefaultError
    );
  });

  it('throws a clear error for circular default references', () => {
    const workflow: WorkflowDefinition = {
      id: 'cycle-default',
      mode: 'linear',
      phaseOrder: ['start'],
      variables: {
        A: { default: '{{B}}' },
        B: { default: '{{A}}' },
      },
      phases: {
        start: {
          title: 'Start',
          template: 'start.md',
          requiredVariables: ['A'],
        },
      },
    };

    expect(() => resolver.resolve(baseTask, 'start', workflow, workflow.phases.start)).toThrow(
      CircularVariableDefaultError
    );
  });
});
