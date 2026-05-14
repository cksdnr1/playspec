import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

  it('loads issue-validate workflow with approval threshold gate and publish artifacts', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    const workflow = await loader.load('issue-validate');

    expect(workflow.id).toBe('issue-validate');
    expect(workflow.phaseOrder).toEqual(['issue_validate', 'publish_result']);
    expect(workflow.variables['ISSUE_NUMBER']?.required).toBe(true);
    expect(workflow.variables['ISSUE_URL']?.required).toBe(true);
    expect(workflow.artifacts['validation']?.path).toBe('{{VALIDATION_FILE}}');
    expect(workflow.artifacts['comment']?.path).toBe('{{ISSUE_COMMENT_FILE}}');
    expect(workflow.artifacts['bodyUpdate']?.path).toBe('{{ISSUE_BODY_UPDATE_FILE}}');
    expect(workflow.phases['issue_validate']?.gate?.results).toEqual(['approved', 'rejected']);
    expect(workflow.phases['issue_validate']?.gate?.nextByResult).toEqual({
      approved: 'publish_result',
      rejected: 'publish_result',
    });
    expect(workflow.phases['publish_result']?.next).toBeNull();

    const requiredVariables = workflow.phaseOrder.flatMap(
      (phaseId) => workflow.phases[phaseId]?.requiredVariables ?? []
    );
    expect(requiredVariables).toEqual(expect.arrayContaining([
      'ISSUE_NUMBER',
      'ISSUE_URL',
      'VALIDATION_FILE',
      'ISSUE_COMMENT_FILE',
      'ISSUE_BODY_UPDATE_FILE',
    ]));
  });

  it('loads issue-scope-create workflow as a separate scoped issue creation workflow', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    const workflow = await loader.load('issue-scope-create');

    expect(workflow.id).toBe('issue-scope-create');
    expect(workflow.phaseOrder).toEqual(['scoped_issue_discovery', 'create_scoped_issues']);
    expect(workflow.variables['TARGET_REPOSITORY']?.required).toBe(true);
    expect(workflow.variables['ISSUE_SCOPE']?.required).toBe(true);
    expect(workflow.variables['FOCUS_AREA']?.required).toBe(true);
    expect(workflow.variables['OUT_OF_SCOPE_RULES']?.required).toBe(true);
    expect(workflow.variables['DUPLICATE_SEARCH_QUERY']?.required).toBe(true);
    expect(workflow.variables['MAX_ISSUES']?.default).toBe('3');
    expect(workflow.variables['ISSUE_LABEL']?.default).toBe('agent-validation');
    expect(workflow.artifacts['discovery']?.path).toBe('{{DISCOVERY_FILE}}');
    expect(workflow.artifacts['candidates']?.path).toBe('{{CANDIDATE_ISSUES_FILE}}');
    expect(workflow.artifacts['createdIssues']?.path).toBe('{{CREATED_ISSUES_FILE}}');
    expect(workflow.phases['scoped_issue_discovery']?.gate?.results).toEqual([
      'candidates_found',
      'no_issues',
    ]);
    expect(workflow.phases['scoped_issue_discovery']?.gate?.nextByResult).toEqual({
      candidates_found: 'create_scoped_issues',
      no_issues: 'create_scoped_issues',
    });
    expect(workflow.phases['create_scoped_issues']?.next).toBeNull();

    const requiredVariables = workflow.phaseOrder.flatMap(
      (phaseId) => workflow.phases[phaseId]?.requiredVariables ?? []
    );
    expect(requiredVariables).toEqual(expect.arrayContaining([
      'TARGET_REPOSITORY',
      'ISSUE_SCOPE',
      'FOCUS_AREA',
      'OUT_OF_SCOPE_RULES',
      'DUPLICATE_SEARCH_QUERY',
      'MAX_ISSUES',
      'ISSUE_LABEL',
      'DISCOVERY_FILE',
      'CANDIDATE_ISSUES_FILE',
      'CREATED_ISSUES_FILE',
    ]));
    expect(workflow.phaseOrder).not.toContain('issue_validate');
    expect(workflow.phaseOrder).not.toContain('publish_result');
  });

  it('ships issue-scope-create templates with scoped non-duplicate issue safeguards', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    const templateRoot = path.join(registry.getBuiltinRoot(), 'issue-scope-create', 'templates');
    const discovery = await readFile(path.join(templateRoot, 'scoped_issue_discovery.md'), 'utf8');
    const creation = await readFile(path.join(templateRoot, 'create_scoped_issues.md'), 'utf8');

    for (const section of [
      '## Problem',
      '## Context',
      '## Impact',
      '## Scope',
      '## Out of scope',
      '## Acceptance criteria',
      '## Test requirements',
      '## Risk notes',
      '## Recommended workflow',
    ]) {
      expect(discovery).toContain(section);
      expect(creation).toContain(section.replace('## ', ''));
    }

    expect(discovery).toContain('Reject a candidate');
    expect(discovery).toContain('Duplicate Search');
    expect(discovery).toContain('Prefer zero issues over broad or speculative issues');
    expect(creation).toContain('Do not implement code in the target repository');
    expect(creation).toContain('Create at most `{{MAX_ISSUES}}` issues');
    expect(creation).toContain('gh issue create --repo {{TARGET_REPOSITORY}} --label {{ISSUE_LABEL}}');
    expect(creation).toContain('Skip the candidate if the duplicate search now finds');
  });

  it('throws WorkflowNotFoundError for unknown workflow', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    await expect(loader.load('nonexistent-workflow')).rejects.toThrow(WorkflowNotFoundError);
  });

  it('rejects unsafe workflow ids before registry filesystem lookup', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    const escapedRoot = path.join(registry.getProjectRoot(), '..', 'escaped-workflow');
    await mkdir(path.join(escapedRoot, 'templates'), { recursive: true });
    await writeFile(
      path.join(escapedRoot, 'workflow.yaml'),
      `id: escaped-workflow
description: Escaped workflow
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
    await writeFile(path.join(escapedRoot, 'templates', 'start.md'), '# Escaped\n', 'utf8');

    await expect(registry.resolve('../escaped-workflow')).rejects.toThrow('path traversal');
    await expect(registry.resolve('../../etc')).rejects.toThrow('path traversal');
    await expect(registry.resolve('/tmp/escaped-workflow')).rejects.toThrow('relative');
    await expect(registry.resolve('bad\0workflow')).rejects.toThrow('null bytes');
  });

  it('rejects unsafe workflow ids at loader entry points', async () => {
    const loader = new WorkflowLoader(workspace.dir);

    await expect(loader.load('../mono-spec')).rejects.toThrow('path traversal');
    await expect(loader.resolve('../../etc')).rejects.toThrow('path traversal');
    await expect(loader.load('/tmp/mono-spec')).rejects.toThrow('relative');
    await expect(loader.resolve('bad\0workflow')).rejects.toThrow('null bytes');
  });

  it('allows workflow ids with hyphens, underscores, and dots', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeWorkflow(registry.getProjectRoot(), 'valid-id_1.v2', 'Valid dotted workflow');

    const workflow = await new WorkflowLoader(workspace.dir).resolve('valid-id_1.v2');

    expect(workflow.id).toBe('valid-id_1.v2');
    expect(workflow.source).toBe('project');
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

  it('resolves builtin workflows when project and user workflows are absent', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await rm(path.join(registry.getProjectRoot(), 'mono-spec'), { recursive: true, force: true });
    await rm(path.join(registry.getUserRoot(), 'mono-spec'), { recursive: true, force: true });

    const workflow = await new WorkflowLoader(workspace.dir).resolve('mono-spec');

    expect(workflow.source).toBe('builtin');
    expect(workflow.definition.description).toBe('Built-in workflow for one feature spec, implementation, tests, and PR prep.');
  });

  it('loads workflows from direct source directories with correct source labels', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeWorkflow(registry.getProjectRoot(), 'project-only', 'Project direct');
    await writeWorkflow(registry.getUserRoot(), 'user-only', 'User direct');

    const loader = new WorkflowLoader(workspace.dir);
    const projectWorkflow = await loader.resolveFromDirectory(path.join(registry.getProjectRoot(), 'project-only'));
    const userWorkflow = await loader.resolveFromDirectory(path.join(registry.getUserRoot(), 'user-only'));
    const builtinWorkflow = await loader.resolveFromDirectory(path.join(registry.getBuiltinRoot(), 'mono-spec'));

    expect(projectWorkflow.source).toBe('project');
    expect(projectWorkflow.id).toBe('project-only');
    expect(userWorkflow.source).toBe('user');
    expect(userWorkflow.id).toBe('user-only');
    expect(builtinWorkflow.source).toBe('builtin');
    expect(builtinWorkflow.id).toBe('mono-spec');
  });

  it('rejects resolveFromDirectory paths with invalid source-root structure', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    const loader = new WorkflowLoader(workspace.dir);
    await writeWorkflow(path.join(registry.getProjectRoot(), 'parent'), 'nested', 'Nested workflow');

    await expect(
      loader.resolveFromDirectory(path.join(registry.getProjectRoot(), 'parent', 'nested'))
    ).rejects.toThrow('direct child');
    await expect(loader.resolveFromDirectory(`${path.join(registry.getProjectRoot(), 'mono-spec')}\0`)).rejects.toThrow(
      'null bytes'
    );
  });

  it('loads custom workflow directories outside known source roots as user workflows', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    await writeWorkflow(workspace.dir, 'outside-workflow', 'Outside workflow');

    const workflow = await loader.resolveFromDirectory(path.join(workspace.dir, 'outside-workflow'));

    expect(workflow.source).toBe('user');
    expect(workflow.id).toBe('outside-workflow');
    expect(workflow.definition.description).toBe('Outside workflow');
  });

  it('rejects resolveFromDirectory when declared id does not match the source directory name', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeWorkflow(registry.getProjectRoot(), 'directory-id', 'Mismatched workflow');
    const workflowFile = path.join(registry.getProjectRoot(), 'directory-id', 'workflow.yaml');
    const content = await readFile(workflowFile, 'utf8');
    await writeFile(workflowFile, content.replace('id: directory-id', 'id: declared-id'), 'utf8');

    await expect(new WorkflowLoader(workspace.dir).resolveFromDirectory(path.dirname(workflowFile))).rejects.toThrow(
      'Workflow id mismatch'
    );
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
