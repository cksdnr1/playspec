import path from 'node:path';
import { homedir } from 'node:os';
import type { PhaseFeedbackConfig, ResolvedWorkflow } from '#core/types.js';
import { WorkflowRegistry } from '#workflow/workflow-registry.js';
import type {
  FeedbackPathKind,
  FeedbackTargetPromptTemplate,
  FeedbackWorkflowSource,
} from './types.js';

export interface FeedbackWorkflowSourceResolution {
  workflowSource: FeedbackWorkflowSource;
  targetPromptTemplate: FeedbackTargetPromptTemplate;
  targetWritable: boolean;
  targetPath: string;
}

export class FeedbackWorkflowSourceResolver {
  constructor(private readonly workspaceRoot: string) {}

  resolve(workflow: ResolvedWorkflow, config: PhaseFeedbackConfig): FeedbackWorkflowSourceResolution {
    const registry = new WorkflowRegistry(this.workspaceRoot);
    const source = this.resolveSource(workflow, registry);
    const targetTemplatePath = this.resolveTargetTemplatePath(workflow, config);
    const writable = source.workflowSource.kind === 'project_local' || source.workflowSource.kind === 'user_global';
    const relativeTemplatePath = path.relative(workflow.rootDir, targetTemplatePath).split(path.sep).join(path.posix.sep);
    const targetPath = this.displayPath(targetTemplatePath, source.workflowSource.rootPathKind);

    return {
      workflowSource: source.workflowSource,
      targetPromptTemplate: {
        path: relativeTemplatePath,
        pathKind: 'workflow_relative',
        writable,
      },
      targetWritable: writable,
      targetPath,
    };
  }

  private resolveSource(
    workflow: ResolvedWorkflow,
    registry: WorkflowRegistry
  ): { workflowSource: FeedbackWorkflowSource } {
    const rootDir = path.resolve(workflow.rootDir);
    if (isWithin(rootDir, registry.getProjectRoot())) {
      return {
        workflowSource: {
          kind: 'project_local',
          root: toWorkspaceRelative(this.workspaceRoot, rootDir),
          rootPathKind: 'workspace_relative',
          version: workflow.definition.version,
        },
      };
    }

    if (isWithin(rootDir, registry.getUserRoot())) {
      return {
        workflowSource: {
          kind: 'user_global',
          root: toHomeRelative(rootDir),
          rootPathKind: 'user_home_relative',
          version: workflow.definition.version,
        },
      };
    }

    if (isWithin(rootDir, registry.getBuiltinRoot())) {
      return {
        workflowSource: {
          kind: 'bundled_preset',
          root: toPackageRelative(rootDir),
          rootPathKind: 'package_relative',
          packageName: 'playspec',
          presetId: 'default',
          version: workflow.definition.version,
        },
      };
    }

    return {
      workflowSource: {
        kind: 'external',
        root: rootDir,
        rootPathKind: 'workspace_relative',
        version: workflow.definition.version,
      },
    };
  }

  private resolveTargetTemplatePath(workflow: ResolvedWorkflow, config: PhaseFeedbackConfig): string {
    const targetPhase = workflow.definition.phases[config.evolutionTargetPhaseId];
    const configuredPath = config.targetPromptTemplate.path;
    const templatePath = targetPhase?.template ?? configuredPath;
    return path.resolve(workflow.templateDir, templatePath);
  }

  private displayPath(filePath: string, pathKind: FeedbackPathKind): string {
    if (pathKind === 'workspace_relative') {
      return toWorkspaceRelative(this.workspaceRoot, filePath);
    }
    if (pathKind === 'user_home_relative') {
      return toHomeRelative(filePath);
    }
    if (pathKind === 'package_relative') {
      return toPackageRelative(filePath);
    }
    return filePath;
  }
}

function isWithin(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toWorkspaceRelative(workspaceRoot: string, filePath: string): string {
  return path.relative(workspaceRoot, filePath).split(path.sep).join(path.posix.sep);
}

function toHomeRelative(filePath: string): string {
  const home = homedir();
  const relative = path.relative(home, filePath);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return `~/${relative.split(path.sep).join(path.posix.sep)}`.replace(/\/$/, '');
  }
  return filePath;
}

function toPackageRelative(filePath: string): string {
  const normalized = filePath.split(path.sep).join(path.posix.sep);
  const marker = '/src/preset/assets/workflows/';
  const index = normalized.lastIndexOf(marker);
  if (index >= 0) {
    return `src/preset/assets/workflows/${normalized.slice(index + marker.length)}`;
  }
  return normalized;
}
