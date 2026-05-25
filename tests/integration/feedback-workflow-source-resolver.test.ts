import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { homedir } from 'node:os';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import { FeedbackWorkflowSourceResolver } from '#evolution/feedback-workflow-source-resolver.js';
import type { PhaseFeedbackConfig, ResolvedWorkflow } from '#core/types.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

function makeWorkflow(rootDir: string, source: ResolvedWorkflow['source'] = 'project'): ResolvedWorkflow {
  return {
    id: 'mono-spec',
    rootDir,
    templateDir: path.join(rootDir, 'templates'),
    source,
    definition: {
      id: 'mono-spec',
      mode: 'linear',
      version: '0.1.0',
      phaseOrder: ['tech_spec_draft'],
      phases: {
        tech_spec_draft: {
          title: 'Tech spec draft',
          template: 'tech_spec_draft.md',
        },
      },
    },
  };
}

function makeConfig(): PhaseFeedbackConfig {
  return {
    enabled: true,
    kind: 'prompt_evolution_signal',
    feedbackThreshold: 80,
    thresholdMode: 'greater_or_equal',
    required: true,
    onFailure: 'record_failure',
    sourcePhaseId: 'tech_spec_validate',
    evaluatedArtifactPhaseId: 'tech_spec_draft',
    evolutionTargetPhaseId: 'tech_spec_draft',
    scoreSource: {
      artifactRole: 'spec',
      markdownFallback: true,
    },
    approval: {
      threshold: 80,
      resultSource: 'completion_result',
    },
    causeClassification: {
      required: true,
      allowed: ['authoring_prompt_gap'],
    },
    targetPromptSnapshot: {
      required: true,
      hashAlgorithm: 'sha256',
    },
    dedupe: {
      enabled: true,
      fields: ['artifactRole'],
    },
    evolution: {
      mode: 'thread_only',
      storageMode: 'thread_with_compact_history',
      targetFiles: ['templates/tech_spec_draft.md'],
    },
    workflowSource: {
      kind: 'project_local',
      root: '.playspec/workflows/mono-spec',
      rootPathKind: 'workspace_relative',
    },
    targetPromptTemplate: {
      path: 'tech_spec_draft.md',
      pathKind: 'workflow_relative',
      writable: true,
    },
    compactHistoryPolicy: {
      maxEntries: 5,
      keepFirst: true,
      keepLatest: 3,
      summarizeOverflow: true,
    },
    proposalReadinessPolicy: {
      mode: 'manual_only_initial',
      minRunCount: 3,
      minNegativeCount: 2,
      minConfidence: 'medium',
      requireHumanReviewBeforeProposal: true,
    },
  };
}

describe('FeedbackWorkflowSourceResolver', () => {
  it('resolves project-local workflow metadata as writable workspace-relative target', () => {
    const registry = new WorkflowRegistry(workspace.dir);
    const workflow = makeWorkflow(path.join(registry.getProjectRoot(), 'mono-spec'), 'project');
    const result = new FeedbackWorkflowSourceResolver(workspace.dir).resolve(workflow, makeConfig());

    expect(result.workflowSource.kind).toBe('project_local');
    expect(result.workflowSource.root).toBe('.playspec/workflows/mono-spec');
    expect(result.targetPromptTemplate.path).toBe('templates/tech_spec_draft.md');
    expect(result.targetPromptTemplate.writable).toBe(true);
    expect(result.targetWritable).toBe(true);
  });

  it('resolves user-global workflow metadata as writable', () => {
    const userRoot = path.join(homedir(), '.playspec', 'workflows', 'mono-spec');
    const workflow = makeWorkflow(userRoot, 'user');
    const result = new FeedbackWorkflowSourceResolver(workspace.dir).resolve(workflow, makeConfig());

    expect(result.workflowSource.kind).toBe('user_global');
    expect(result.workflowSource.root).toBe('~/.playspec/workflows/mono-spec');
    expect(result.workflowSource.rootPathKind).toBe('user_home_relative');
    expect(result.targetWritable).toBe(true);
  });

  it('resolves bundled preset metadata as non-writable package-relative target', () => {
    const registry = new WorkflowRegistry(workspace.dir);
    const workflow = makeWorkflow(path.join(registry.getBuiltinRoot(), 'mono-spec'), 'builtin');
    const result = new FeedbackWorkflowSourceResolver(workspace.dir).resolve(workflow, makeConfig());

    expect(result.workflowSource.kind).toBe('bundled_preset');
    expect(result.workflowSource.rootPathKind).toBe('package_relative');
    expect(result.workflowSource.presetId).toBe('default');
    expect(result.targetWritable).toBe(false);
    expect(result.targetPromptTemplate.writable).toBe(false);
  });

  it('resolves external workflow roots as non-writable', () => {
    const workflow = makeWorkflow(path.join(workspace.dir, 'external-workflows', 'custom'), 'user');
    const result = new FeedbackWorkflowSourceResolver(workspace.dir).resolve(workflow, makeConfig());

    expect(result.workflowSource.kind).toBe('external');
    expect(result.targetWritable).toBe(false);
    expect(result.targetPromptTemplate.writable).toBe(false);
  });
});
