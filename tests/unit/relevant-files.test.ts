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
    },
    phases: {
      implementation: {
        title: 'Implementation',
        template,
        requiredVariables: ['SPEC_FILE', 'PLAN_FILE'],
        outputs: ['RESULT_FILE', 'docs/features/feature_x/generated.md'],
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
