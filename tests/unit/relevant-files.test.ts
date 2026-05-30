import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { discoverRelevantFiles } from '#core/relevant-files.js';
import type { TaskRecord, WorkflowDefinition } from '#core/types.js';
import { writeTextFile } from '#utils/fs.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'feature_x',
    title: 'Feature X',
    workflow: 'mono-spec',
    status: 'active',
    workflowMode: 'linear',
    currentPhase: 'implementation',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    paths: {
      taskRoot: '.playspec/tasks/active/feature_x',
      projectDocRoot: 'docs/features/feature_x',
    },
    variables: { FEATURE_SLUG: 'feature_x' },
    phaseHistory: [],
    ...overrides,
  };
}

function templateRoot(): string {
  return path.join(workspace.dir, 'workflow', 'templates');
}

function workflow(template = 'implementation.md'): WorkflowDefinition {
  return {
    id: 'mono-spec',
    mode: 'linear',
    phaseOrder: ['implementation'],
    variables: {
      FEATURE_SLUG: { required: true },
      SPEC_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/spec.md' },
      PLAN_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/plan.md' },
      RESULT_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/result.md' },
      PR_FILE: { default: 'docs/features/{{FEATURE_SLUG}}/pr.md' },
    },
    artifacts: {
      spec: { path: '{{SPEC_FILE}}', kind: 'spec' },
      generated: { path: 'docs/features/{{FEATURE_SLUG}}/generated.md', kind: 'generated' },
      artifactOnly: { path: 'docs/features/{{FEATURE_SLUG}}/artifact-only.md', kind: 'artifact-only' },
    },
    phases: {
      implementation: {
        title: 'Implementation',
        template,
        requiredVariables: ['SPEC_FILE', 'PLAN_FILE'],
        outputs: [
          'RESULT_FILE',
          'docs/features/feature_x/generated.md',
          'docs/features/{{FEATURE_SLUG}}/output-only.md',
        ],
      },
    },
  };
}

async function writeTemplate(content: string, template = 'implementation.md'): Promise<void> {
  await writeTextFile(path.join(templateRoot(), template), content);
}

describe('discoverRelevantFiles', () => {
  it('collects context refs, task sources, variables, workflow metadata, rendered paths, and project docs in priority order', async () => {
    await writeTemplate('Use `docs/features/feature_x/from_prompt.md` and {{SPEC_FILE}}.');
    await writeTextFile(path.join(workspace.dir, 'docs/context.md'), '# Context\n');
    await writeTextFile(path.join(workspace.dir, '.playspec/tasks/active/feature_x/sources/source_problem.md'), '# Source\n');
    await writeTextFile(path.join(workspace.dir, 'docs/features/feature_x/spec.md'), '# Spec\n');
    await writeTextFile(path.join(workspace.dir, 'docs/features/feature_x/notes.md'), '# Notes\n');

    const result = await discoverRelevantFiles({
      workspaceRoot: workspace.dir,
      task: task({
        contextRefs: [{ path: 'docs/context.md', role: 'source-problem', source: 'stdin' }],
        variables: {
          FEATURE_SLUG: 'feature_x',
          EXTRA_DOC: 'docs/features/feature_x/extra.md',
        },
      }),
      workflow: workflow(),
      templateDir: templateRoot(),
      phaseId: 'implementation',
      definition: workflow().phases.implementation,
    });

    const candidates = result.candidates.map((candidate) => [candidate.path, candidate.source, candidate.exists]);
    expect(candidates[0]).toEqual(['docs/context.md', 'context-ref', true]);
    expect(candidates[1]).toEqual(['.playspec/tasks/active/feature_x/sources/source_problem.md', 'task-source', true]);
    expect(candidates).toContainEqual(['docs/features/feature_x/extra.md', 'variable', false]);
    expect(candidates).toContainEqual(['docs/features/feature_x/plan.md', 'variable', false]);
    expect(candidates).toContainEqual(['docs/features/feature_x/pr.md', 'variable', false]);
    expect(candidates).toContainEqual(['docs/features/feature_x/result.md', 'variable', false]);
    expect(candidates).toContainEqual(['docs/features/feature_x/spec.md', 'variable', true]);
    expect(candidates).toContainEqual(['docs/features/feature_x/generated.md', 'workflow', false]);
    expect(candidates).toContainEqual(['docs/features/feature_x/artifact-only.md', 'workflow', false]);
    expect(candidates).toContainEqual(['docs/features/feature_x/output-only.md', 'workflow', false]);
    expect(candidates).toContainEqual(['docs/features/feature_x/from_prompt.md', 'rendered-prompt', false]);
    expect(candidates.at(-1)).toEqual(['docs/features/feature_x/notes.md', 'project-doc-root', true]);
  });

  it('parses context list variables and deduplicates with highest-priority source', async () => {
    await writeTemplate('No rendered paths.');
    await writeTextFile(path.join(workspace.dir, 'docs/context.md'), '# Context\n');

    const result = await discoverRelevantFiles({
      workspaceRoot: workspace.dir,
      task: task({
        contextRefs: [{ path: 'docs/context.md', role: 'planning-context', source: 'manual' }],
        variables: { FEATURE_SLUG: 'feature_x', DUPLICATE_FILE: 'docs/context.md' },
      }),
      workflow: workflow(),
      templateDir: templateRoot(),
      phaseId: 'implementation',
      definition: workflow().phases.implementation,
    });

    const duplicate = result.candidates.find((candidate) => candidate.path === 'docs/context.md');
    expect(duplicate?.source).toBe('context-ref');
    expect(result.candidates.filter((candidate) => candidate.path === 'docs/context.md')).toHaveLength(1);
  });

  it('ignores issue-scope-create prompt metadata while keeping rendered artifact paths', async () => {
    const outputDir = 'docs/issues/scope-create/hourly_issue_discovery_cksdnr1_playspec_20260528t221959z';
    const discoveryFile = `${outputDir}/discovery.md`;
    const candidatesFile = `${outputDir}/candidate_issues.md`;
    const createdIssuesFile = `${outputDir}/created_issues.md`;
    const issueScopeWorkflow: WorkflowDefinition = {
      id: 'issue-scope-create',
      mode: 'linear',
      phaseOrder: ['scoped_issue_discovery'],
      variables: {
        TARGET_REPOSITORY: { required: true },
        ISSUE_SCOPE: { required: true },
        FOCUS_AREA: { required: true },
        OUT_OF_SCOPE_RULES: { required: true },
        DUPLICATE_SEARCH_QUERY: { required: true },
        OUTPUT_DIR: { default: 'docs/issues/scope-create/{{TASK_ID}}' },
        DISCOVERY_FILE: { default: '{{OUTPUT_DIR}}/discovery.md' },
        CANDIDATE_ISSUES_FILE: { default: '{{OUTPUT_DIR}}/candidate_issues.md' },
        CREATED_ISSUES_FILE: { default: '{{OUTPUT_DIR}}/created_issues.md' },
      },
      artifacts: {
        discovery: { path: '{{DISCOVERY_FILE}}' },
        candidates: { path: '{{CANDIDATE_ISSUES_FILE}}' },
        createdIssues: { path: '{{CREATED_ISSUES_FILE}}' },
      },
      phases: {
        scoped_issue_discovery: {
          title: 'Scoped issue discovery',
          template: 'issue-scope-create.md',
          requiredVariables: [
            'TARGET_REPOSITORY',
            'ISSUE_SCOPE',
            'FOCUS_AREA',
            'DISCOVERY_FILE',
            'CANDIDATE_ISSUES_FILE',
            'CREATED_ISSUES_FILE',
          ],
          outputs: ['{{DISCOVERY_FILE}}', '{{CANDIDATE_ISSUES_FILE}}'],
        },
      },
    };
    await writeTemplate([
      '**Target repository:** `{{TARGET_REPOSITORY}}`',
      '**Task:** `{{TASK_TITLE}}`',
      '**Focus area:** `{{FOCUS_AREA}}`',
      'Write `{{DISCOVERY_FILE}}`, `{{CANDIDATE_ISSUES_FILE}}`, and `{{CREATED_ISSUES_FILE}}`.',
      'Also inspect `docs/features/feature_x/spec.md`.',
    ].join('\n'), 'issue-scope-create.md');

    const result = await discoverRelevantFiles({
      workspaceRoot: workspace.dir,
      task: task({
        id: 'hourly_issue_discovery_cksdnr1_playspec_20260528t221959z',
        title: 'Hourly issue discovery: cksdnr1/playspec (20260528T221959Z)',
        workflow: 'issue-scope-create',
        currentPhase: 'scoped_issue_discovery',
        paths: {
          taskRoot: '.playspec/tasks/active/hourly_issue_discovery_cksdnr1_playspec_20260528t221959z',
          projectDocRoot: outputDir,
        },
        variables: {
          TARGET_REPOSITORY: 'cksdnr1/playspec',
          ISSUE_SCOPE: 'hourly discovery',
          FOCUS_AREA: 'src/core, src/template, src/workflow, docs/features, tests/integration',
          OUT_OF_SCOPE_RULES: 'Do not implement code.',
          DUPLICATE_SEARCH_QUERY: 'repo:cksdnr1/playspec metadata paths',
        },
      }),
      workflow: issueScopeWorkflow,
      templateDir: templateRoot(),
      phaseId: 'scoped_issue_discovery',
      definition: issueScopeWorkflow.phases.scoped_issue_discovery,
    });

    const paths = result.candidates.map((candidate) => candidate.path);
    expect(paths).toContain(discoveryFile);
    expect(paths).toContain(candidatesFile);
    expect(paths).toContain(createdIssuesFile);
    expect(paths).toContain('docs/features/feature_x/spec.md');
    expect(paths).not.toContain('cksdnr1/playspec');
    expect(paths).not.toContain('Hourly issue discovery: cksdnr1/playspec (20260528T221959Z)');
    expect(paths).not.toContain('src/core, src/template, src/workflow, docs/features, tests/integration');
  });

  it('warns and skips workflow paths with unresolved embedded placeholders', async () => {
    await writeTemplate('No rendered paths.');
    const unresolvedWorkflow = workflow();
    unresolvedWorkflow.artifacts = {
      unresolved: { path: 'docs/features/{{UNKNOWN_SLUG}}/artifact.md' },
    };
    unresolvedWorkflow.phases.implementation.outputs = [
      'docs/features/{{UNKNOWN_SLUG}}/output.md',
    ];

    const result = await discoverRelevantFiles({
      workspaceRoot: workspace.dir,
      task: task(),
      workflow: unresolvedWorkflow,
      templateDir: templateRoot(),
      phaseId: 'implementation',
      definition: unresolvedWorkflow.phases.implementation,
    });

    expect(result.candidates.map((candidate) => candidate.path)).not.toContain('docs/features/{{UNKNOWN_SLUG}}/artifact.md');
    expect(result.candidates.map((candidate) => candidate.path)).not.toContain('docs/features/{{UNKNOWN_SLUG}}/output.md');
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('unresolved template placeholder');
  });

  it('warns and skips invalid paths while preserving valid candidates', async () => {
    await writeTemplate('Broken {{MISSING_VAR}}');
    await writeTextFile(path.join(workspace.dir, 'docs/features/feature_x/spec.md'), '# Spec\n');
    await writeTextFile(path.join(workspace.dir, '.playspec/templates/internal.md'), '# Internal\n');

    const result = await discoverRelevantFiles({
      workspaceRoot: workspace.dir,
      task: task({
        variables: {
          FEATURE_SLUG: 'feature_x',
          ABS_FILE: '/tmp/outside.md',
          URL_FILE: 'https://example.com/spec.md',
          SHELL_FILE: 'docs/file.md; rm -rf .',
          TEMPLATE_FILE: '.playspec/templates/internal.md',
          ESCAPE_FILE: '../outside.md',
          PLACEHOLDER_FILE: '(none)',
        },
      }),
      workflow: workflow(),
      templateDir: templateRoot(),
      phaseId: 'implementation',
      definition: workflow().phases.implementation,
    });

    expect(result.candidates.some((candidate) => candidate.path === 'docs/features/feature_x/spec.md')).toBe(true);
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('absolute paths are not accepted');
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('URLs are not workspace files');
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('shell-looking value');
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('template dependency is not a user document');
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('path escapes workspace');
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('placeholder value');
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('Rendered prompt path discovery skipped');
  });

  it('skips existing symlinks that resolve outside the workspace', async () => {
    await writeTemplate('No rendered paths.');
    const outsideDir = path.join(workspace.dir, '..', `outside-${Date.now()}`);
    await mkdir(outsideDir, { recursive: true });
    await writeTextFile(path.join(outsideDir, 'secret.md'), '# Secret\n');
    await mkdir(path.join(workspace.dir, 'docs/features/feature_x'), { recursive: true });
    await symlink(path.join(outsideDir, 'secret.md'), path.join(workspace.dir, 'docs/features/feature_x/secret.md'));

    const result = await discoverRelevantFiles({
      workspaceRoot: workspace.dir,
      task: task({ variables: { FEATURE_SLUG: 'feature_x', SECRET_FILE: 'docs/features/feature_x/secret.md' } }),
      workflow: workflow(),
      templateDir: templateRoot(),
      phaseId: 'implementation',
      definition: workflow().phases.implementation,
    });

    expect(result.candidates.some((candidate) => candidate.path.endsWith('secret.md'))).toBe(false);
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain('symlink escapes workspace');
  });

  it('discovers legacy non-mono derived files through variables', async () => {
    await writeTemplate('Use {{PHASE_SPEC_FILE}} and {{PHASE_HANDOFF_FILE}}.', 'phase_template.md');
    const legacyTask = task({
      workflow: 'multi-spec',
      currentPhase: '3',
      variables: { FEATURE_SLUG: 'feature_x' },
    });
    const legacyWorkflow = workflow('phase_template.md');
    legacyWorkflow.id = 'multi-spec';
    legacyWorkflow.phaseOrder = ['3'];
    legacyWorkflow.variables = {
      FEATURE_SLUG: { required: true },
      PHASE_SPEC_FILE: {
        default: 'docs/{{FEATURE_SLUG}}/{{FEATURE_SLUG}}_phase{{PHASE_NUMBER}}_implementation_spec.md',
      },
      PHASE_HANDOFF_FILE: {
        default: 'docs/{{FEATURE_SLUG}}/{{FEATURE_SLUG}}_phase{{PHASE_NUMBER}}_handoff.md',
      },
    };
    legacyWorkflow.phases = {
      '3': {
        title: 'Phase 3',
        template: 'phase_template.md',
        requiredVariables: ['PHASE_SPEC_FILE', 'PHASE_HANDOFF_FILE'],
      },
    };

    const result = await discoverRelevantFiles({
      workspaceRoot: workspace.dir,
      task: legacyTask,
      workflow: legacyWorkflow,
      templateDir: templateRoot(),
      phaseId: '3',
      definition: legacyWorkflow.phases['3'],
    });

    expect(result.candidates.map((candidate) => candidate.path)).toContain('docs/feature_x/feature_x_phase3_implementation_spec.md');
    expect(result.candidates.map((candidate) => candidate.path)).toContain('docs/feature_x/feature_x_phase3_handoff.md');
  });
});
