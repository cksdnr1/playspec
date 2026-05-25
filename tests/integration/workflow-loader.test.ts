import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { WorkflowNotFoundError } from '#core/errors.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
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
  async function writeWorkflow(
    root: string,
    id: string,
    description: string,
    options: { acceptedBuiltinShadow?: boolean } = {}
  ): Promise<void> {
    await mkdir(path.join(root, id, 'templates'), { recursive: true });
    await writeFile(
      path.join(root, id, 'workflow.yaml'),
      `id: ${id}
description: ${description}
${options.acceptedBuiltinShadow ? `builtinShadow:
  accepted: true
` : ''}mode: linear
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

  async function writeWorkflowInDirectory(root: string, id: string, description: string): Promise<void> {
    await mkdir(path.join(root, 'templates'), { recursive: true });
    await writeFile(
      path.join(root, 'workflow.yaml'),
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
    await writeFile(path.join(root, 'templates', 'start.md'), '# {{TASK_TITLE}}\n', 'utf8');
  }

  async function writeFeedbackWorkflow(
    root: string,
    transform: (content: string) => string = (content) => content
  ): Promise<void> {
    await mkdir(path.join(root, 'templates'), { recursive: true });
    const workflow = `id: feedback-workflow
description: Feedback workflow
mode: linear
phaseOrder:
  - draft
  - validate
  - target
phases:
  draft:
    title: Draft
    template: draft.md
    requiredVariables:
      - SPEC_FILE
  validate:
    title: Validate
    template: validate.md
    feedback:
      enabled: true
      kind: prompt_evolution_signal
      feedbackThreshold: 90
      thresholdMode: greater_or_equal
      required: true
      onFailure: fail_completion
      sourcePhaseId: validate
      evaluatedArtifactPhaseId: draft
      evolutionTargetPhaseId: target
      scoreSource:
        artifactRole: validation_report
        preferredBlock: playspecFeedback
        markdownFallback: true
      approval:
        threshold: 95
        resultSource: completion_result
      causeClassification:
        required: true
        allowed:
          - artifact_quality_issue
          - authoring_prompt_gap
          - validation_prompt_gap
          - workflow_policy_gap
          - extractor_or_parser_error
      targetPromptSnapshot:
        required: true
        hashAlgorithm: sha256
      dedupe:
        enabled: true
        fields:
          - workflowId
          - evolutionTargetPhaseId
          - targetType
          - targetGuidanceSection
          - causeCategory
          - suspectedCause
          - suggestedChangeFingerprint
      evolution:
        mode: thread_only
        storageMode: thread_with_compact_history
        targetFiles:
          - .playspec/workflows/mono-spec/templates/tech_spec_draft.md
      workflowSource:
        kind: project_local
        root: .playspec/workflows/mono-spec
        rootPathKind: workspace_relative
      targetPromptTemplate:
        path: .playspec/workflows/mono-spec/templates/tech_spec_draft.md
        pathKind: workspace_relative
        writable: true
      compactHistoryPolicy:
        maxEntries: 20
        keepFirst: true
        keepLatest: 10
        summarizeOverflow: true
      proposalReadinessPolicy:
        mode: manual_only_initial
        minRunCount: 3
        minNegativeCount: 2
        minConfidence: medium
        requireHumanReviewBeforeProposal: true
  target:
    title: Target
    template: target.md
`;
    await writeFile(path.join(root, 'workflow.yaml'), transform(workflow), 'utf8');
    await writeFile(path.join(root, 'templates', 'draft.md'), '# Draft\n', 'utf8');
    await writeFile(path.join(root, 'templates', 'validate.md'), '# Validate\n', 'utf8');
    await writeFile(path.join(root, 'templates', 'target.md'), '# Target\n', 'utf8');
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

  it('loads workflows without feedback config unchanged', async () => {
    const workflowRoot = path.join(workspace.dir, 'no-feedback-workflow');
    await writeWorkflowInDirectory(workflowRoot, 'no-feedback-workflow', 'No feedback workflow');

    const workflow = await new WorkflowLoader(workspace.dir).resolveFromDirectory(workflowRoot);

    expect(workflow.definition.phases['start']?.feedback).toBeUndefined();
  });

  it('loads workflow feedback config and preserves separate source, evaluated, and target phases', async () => {
    const workflowRoot = path.join(workspace.dir, 'feedback-workflow');
    await writeFeedbackWorkflow(workflowRoot);

    const workflow = await new WorkflowLoader(workspace.dir).resolveFromDirectory(workflowRoot);
    const feedback = workflow.definition.phases['validate']?.feedback;

    expect(feedback?.kind).toBe('prompt_evolution_signal');
    expect(feedback?.sourcePhaseId).toBe('validate');
    expect(feedback?.evaluatedArtifactPhaseId).toBe('draft');
    expect(feedback?.evolutionTargetPhaseId).toBe('target');
    expect(feedback?.feedbackThreshold).toBe(90);
    expect(feedback?.evolution.storageMode).toBe('thread_with_compact_history');
    expect(feedback?.workflowSource.kind).toBe('project_local');
    expect(feedback?.targetPromptTemplate.pathKind).toBe('workspace_relative');
  });

  it.each([
    [
      'invalid feedback threshold',
      (content: string) => content.replace('feedbackThreshold: 90', 'feedbackThreshold: 101'),
    ],
    ['invalid feedback kind', (content: string) => content.replace('kind: prompt_evolution_signal', 'kind: unknown_signal')],
    ['invalid failure policy', (content: string) => content.replace('onFailure: fail_completion', 'onFailure: ignore')],
    [
      'invalid storage mode',
      (content: string) =>
        content.replace('storageMode: thread_with_compact_history', 'storageMode: file_per_validation_run'),
    ],
    ['invalid compact history policy', (content: string) => content.replace('keepLatest: 10', 'keepLatest: 21')],
    [
      'invalid proposal readiness policy',
      (content: string) => content.replace('mode: manual_only_initial', 'mode: auto_when_ready'),
    ],
    ['invalid workflow source kind', (content: string) => content.replace('kind: project_local', 'kind: production')],
    [
      'invalid workflow source path kind',
      (content: string) => content.replace('rootPathKind: workspace_relative', 'rootPathKind: remote_url'),
    ],
    [
      'invalid target prompt path kind',
      (content: string) => content.replace('pathKind: workspace_relative', 'pathKind: remote_url'),
    ],
  ])('rejects feedback config with %s', async (_name, transform) => {
    const workflowRoot = path.join(workspace.dir, 'feedback-workflow');
    await writeFeedbackWorkflow(workflowRoot, transform);

    await expect(new WorkflowLoader(workspace.dir).resolveFromDirectory(workflowRoot)).rejects.toThrow();
  });

  it.each([
    ['sourcePhaseId', 'sourcePhaseId: missing_source'],
    ['evaluatedArtifactPhaseId', 'evaluatedArtifactPhaseId: missing_evaluated'],
    ['evolutionTargetPhaseId', 'evolutionTargetPhaseId: missing_target'],
  ])('rejects feedback config with missing %s reference', async (_field, replacement) => {
    const workflowRoot = path.join(workspace.dir, 'feedback-workflow');
    await writeFeedbackWorkflow(workflowRoot, (content) =>
      content.replace(new RegExp(`${_field}: [^\\n]+`), replacement)
    );

    await expect(new WorkflowLoader(workspace.dir).resolveFromDirectory(workflowRoot)).rejects.toThrow(
      `feedback.${_field} references missing phase`
    );
  });

  it('resolves workflow definitions from an explicit directory', async () => {
    const workflowRoot = path.join(workspace.dir, 'custom-workflow');
    await writeWorkflowInDirectory(workflowRoot, 'custom-workflow', 'Custom workflow');

    const workflow = await new WorkflowLoader(workspace.dir).resolveFromDirectory(workflowRoot);

    expect(workflow.id).toBe('custom-workflow');
    expect(workflow.rootDir).toBe(workflowRoot);
    expect(workflow.templateDir).toBe(path.join(workflowRoot, 'templates'));
    expect(workflow.source).toBe('user');
    expect(workflow.definition.description).toBe('Custom workflow');
    expect(workflow.definition.mode).toBe('linear');
    expect(workflow.definition.phaseOrder).toEqual(['start']);
    expect(workflow.definition.phases['start']?.template).toBe('start.md');
  });

  it('rejects explicit workflow directories without workflow.yaml', async () => {
    const workflowRoot = path.join(workspace.dir, 'missing-workflow-file');
    await mkdir(workflowRoot, { recursive: true });

    await expect(new WorkflowLoader(workspace.dir).resolveFromDirectory(workflowRoot)).rejects.toThrow();
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
    expect(workflow.variables['OUTPUT_DIR']?.default).toBe('docs/issues/scope-create/{{TASK_ID}}');
    expect(workflow.variables['OUTPUT_DIR']?.default).not.toBe('docs/issues/scope-create');
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

  it('falls back to built-in assets for an unaccepted stale project shadow', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeWorkflow(registry.getProjectRoot(), 'mono-spec', 'Stale project override');

    const workflow = await new WorkflowLoader(workspace.dir).resolve('mono-spec');

    expect(workflow.source).toBe('builtin');
    expect(workflow.shadow).toEqual(expect.objectContaining({
      shadowSource: 'project',
      differsFromBuiltin: true,
      accepted: false,
      usingBuiltinFallback: true,
    }));
    expect(workflow.definition.description).toBe('Built-in workflow for one feature spec, implementation, tests, and PR prep.');
  });

  it('keeps an explicitly accepted project shadow usable', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeWorkflow(registry.getProjectRoot(), 'mono-spec', 'Accepted project override', {
      acceptedBuiltinShadow: true,
    });

    const workflow = await new WorkflowLoader(workspace.dir).resolve('mono-spec');

    expect(workflow.source).toBe('project');
    expect(workflow.shadow).toEqual(expect.objectContaining({
      shadowSource: 'project',
      differsFromBuiltin: true,
      accepted: true,
      usingBuiltinFallback: false,
    }));
    expect(workflow.definition.description).toBe('Accepted project override');
  });

  it('renders current built-in issue-scope-create prompt content when the project copy is stale', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeFile(
      path.join(registry.getProjectRoot(), 'issue-scope-create', 'templates', 'scoped_issue_discovery.md'),
      '# Stale local issue discovery\n\nThis stale project template must not render.\n',
      'utf8'
    );

    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({
      id: 'stale_issue_scope_prompt',
      title: 'Stale Issue Scope Prompt',
      workflow: 'issue-scope-create',
      variables: {
        TARGET_REPOSITORY: 'cksdnr1/playspec',
        ISSUE_SCOPE: 'workflow shadows',
        FOCUS_AREA: 'issue-scope-create',
        OUT_OF_SCOPE_RULES: 'Do not inspect unrelated features.',
        DUPLICATE_SEARCH_QUERY: 'repo:cksdnr1/playspec workflow shadow',
      },
    });

    const prompt = await new PlaySpecCore(workspace.dir, store).renderNextPrompt('stale_issue_scope_prompt');

    expect(prompt).toContain('Replacement Search');
    expect(prompt).toContain('replacement candidate');
    expect(prompt).not.toContain('This stale project template must not render.');
  });

  it('throws WorkflowNotFoundError for unknown workflow', async () => {
    const loader = new WorkflowLoader(workspace.dir);
    await expect(loader.load('nonexistent-workflow')).rejects.toThrow(WorkflowNotFoundError);
  });

  it('derives the builtin workflow root from preset assets', () => {
    const registry = new WorkflowRegistry(workspace.dir);
    const normalizedRoot = registry.getBuiltinRoot().split(path.sep).join('/');

    expect(normalizedRoot).toMatch(/\/(src|dist)\/preset\/assets\/workflows$/);
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

  it('resolves accepted project workflows before user and builtin workflows', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await writeWorkflow(registry.getUserRoot(), 'mono-spec', 'User override');
    await writeWorkflow(registry.getProjectRoot(), 'mono-spec', 'Project override', {
      acceptedBuiltinShadow: true,
    });

    const workflow = await new WorkflowLoader(workspace.dir).resolve('mono-spec');

    expect(workflow.source).toBe('project');
    expect(workflow.definition.description).toBe('Project override');
  });

  it('resolves accepted user workflows before builtin when project workflow is absent', async () => {
    const registry = new WorkflowRegistry(workspace.dir);
    await rm(path.join(registry.getProjectRoot(), 'mono-spec'), { recursive: true, force: true });
    await writeWorkflow(registry.getUserRoot(), 'mono-spec', 'User override', {
      acceptedBuiltinShadow: true,
    });

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
