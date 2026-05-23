import { access, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { WorkflowDefinitionSchema } from '#core/schemas.js';
import type { PhaseDefinition, TaskSummary, WorkflowDefinition } from '#core/types.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { writeTextFile, writeTextFileAtomic } from '#utils/fs.js';
import { getProjectWorkflowsRoot } from '#utils/paths.js';
import { WorkflowLoader } from './workflow-loader.js';

export type WorkflowEditCommand = 'add-phase' | 'remove-phase' | 'reorder-phase' | 'set-template';

export interface WorkflowEditReport {
  command: WorkflowEditCommand;
  workflowId: string;
  targetPath: string;
  backupPath: string;
  beforePhaseIds: string[];
  afterPhaseIds: string[];
  activeTaskCompatibility: {
    compatible: boolean;
    checkedTaskIds: string[];
    blockingTaskIds: string[];
  };
  validation: {
    success: boolean;
    message: string;
  };
  replacement?: string;
  createdAt: string;
  success: boolean;
}

export interface WorkflowEditResult {
  workflowId: string;
  targetPath: string;
  backupPath: string;
  reportPath: string;
  beforePhaseIds: string[];
  afterPhaseIds: string[];
}

export interface AddPhaseInput {
  workflowId: string;
  afterPhaseId: string;
  newPhaseId: string;
  title: string;
  templatePath: string;
}

export interface RemovePhaseInput {
  workflowId: string;
  phaseId: string;
  replacement?: string;
}

export interface ReorderPhaseInput {
  workflowId: string;
  phaseId: string;
  afterPhaseId: string;
}

export interface SetTemplateInput {
  workflowId: string;
  phaseId: string;
  templatePath: string;
}

interface LoadedEditableWorkflow {
  definition: WorkflowDefinition;
  workflowFile: string;
  templateDir: string;
}

export class WorkflowEditor {
  private readonly loader: WorkflowLoader;
  private readonly taskStore: YamlTaskStore;

  constructor(private readonly workspaceRoot: string) {
    this.loader = new WorkflowLoader(workspaceRoot);
    this.taskStore = new YamlTaskStore(workspaceRoot);
  }

  async addPhase(input: AddPhaseInput): Promise<WorkflowEditResult> {
    const loaded = await this.loadEditableWorkflow(input.workflowId);
    const definition = cloneWorkflowDefinition(loaded.definition);
    const beforePhaseIds = [...definition.phaseOrder];

    if (definition.phases[input.newPhaseId] || definition.phaseOrder.includes(input.newPhaseId)) {
      throw new Error(`Workflow "${input.workflowId}" already has phase "${input.newPhaseId}".`);
    }
    const afterIndex = definition.phaseOrder.indexOf(input.afterPhaseId);
    if (afterIndex === -1) {
      throw new Error(`Workflow "${input.workflowId}" does not have phase "${input.afterPhaseId}".`);
    }
    await this.validateTemplatePath(loaded.templateDir, input.templatePath);

    const phase: PhaseDefinition = {
      title: input.title,
      template: input.templatePath,
    };
    definition.phases[input.newPhaseId] = phase;
    definition.phaseOrder.splice(afterIndex + 1, 0, input.newPhaseId);

    return this.persistEdit('add-phase', loaded, definition, beforePhaseIds);
  }

  async removePhase(input: RemovePhaseInput): Promise<WorkflowEditResult> {
    const loaded = await this.loadEditableWorkflow(input.workflowId);
    const definition = cloneWorkflowDefinition(loaded.definition);
    const beforePhaseIds = [...definition.phaseOrder];

    if (!definition.phases[input.phaseId] || !definition.phaseOrder.includes(input.phaseId)) {
      throw new Error(`Workflow "${input.workflowId}" does not have phase "${input.phaseId}".`);
    }

    delete definition.phases[input.phaseId];
    definition.phaseOrder = definition.phaseOrder.filter((phaseId) => phaseId !== input.phaseId);

    return this.persistEdit('remove-phase', loaded, definition, beforePhaseIds, input.replacement);
  }

  async reorderPhase(input: ReorderPhaseInput): Promise<WorkflowEditResult> {
    const loaded = await this.loadEditableWorkflow(input.workflowId);
    const definition = cloneWorkflowDefinition(loaded.definition);
    const beforePhaseIds = [...definition.phaseOrder];

    if (!definition.phaseOrder.includes(input.phaseId)) {
      throw new Error(`Workflow "${input.workflowId}" does not have phase "${input.phaseId}".`);
    }
    if (!definition.phaseOrder.includes(input.afterPhaseId)) {
      throw new Error(`Workflow "${input.workflowId}" does not have phase "${input.afterPhaseId}".`);
    }
    if (input.phaseId === input.afterPhaseId) {
      throw new Error('A phase cannot be reordered after itself.');
    }

    definition.phaseOrder = definition.phaseOrder.filter((phaseId) => phaseId !== input.phaseId);
    const afterIndex = definition.phaseOrder.indexOf(input.afterPhaseId);
    definition.phaseOrder.splice(afterIndex + 1, 0, input.phaseId);

    return this.persistEdit('reorder-phase', loaded, definition, beforePhaseIds);
  }

  async setTemplate(input: SetTemplateInput): Promise<WorkflowEditResult> {
    const loaded = await this.loadEditableWorkflow(input.workflowId);
    const definition = cloneWorkflowDefinition(loaded.definition);
    const beforePhaseIds = [...definition.phaseOrder];

    const phase = definition.phases[input.phaseId];
    if (!phase || !definition.phaseOrder.includes(input.phaseId)) {
      throw new Error(`Workflow "${input.workflowId}" does not have phase "${input.phaseId}".`);
    }
    await this.validateTemplatePath(loaded.templateDir, input.templatePath);

    definition.phases[input.phaseId] = {
      ...phase,
      template: input.templatePath,
    };

    return this.persistEdit('set-template', loaded, definition, beforePhaseIds);
  }

  private async loadEditableWorkflow(workflowId: string): Promise<LoadedEditableWorkflow> {
    const projectWorkflowRoot = path.join(getProjectWorkflowsRoot(this.workspaceRoot), workflowId);
    try {
      await access(path.join(projectWorkflowRoot, 'workflow.yaml'));
    } catch {
      throw new Error(
        `Workflow "${workflowId}" is not installed as a project workflow and is read-only for edit commands. Install or export it into .playspec/workflows first.`
      );
    }

    const resolved = await this.loader.resolveFromDirectory(projectWorkflowRoot);
    if (resolved.source !== 'project') {
      throw new Error(
        `Workflow "${workflowId}" is ${resolved.source} and is read-only for edit commands. Install or export it into .playspec/workflows first.`
      );
    }
    return {
      definition: resolved.definition,
      workflowFile: path.join(resolved.rootDir, 'workflow.yaml'),
      templateDir: resolved.templateDir,
    };
  }

  private async persistEdit(
    command: WorkflowEditCommand,
    loaded: LoadedEditableWorkflow,
    definition: WorkflowDefinition,
    beforePhaseIds: string[],
    replacement?: string
  ): Promise<WorkflowEditResult> {
    const validatedDefinition = WorkflowDefinitionSchema.parse(definition);
    await this.loader.validateWorkflowDefinition(validatedDefinition, loaded.templateDir);

    const compatibility = await this.checkActiveTaskCompatibility(validatedDefinition.id, validatedDefinition.phaseOrder);
    if (!compatibility.compatible) {
      throw new Error(
        `Workflow edit would orphan active task current phase for task(s): ${compatibility.blockingTaskIds.join(', ')}.`
      );
    }

    const timestamp = createFilesystemTimestamp();
    const workflowRoot = getProjectWorkflowsRoot(this.workspaceRoot);
    const backupPath = path.join(workflowRoot, '.backups', `${validatedDefinition.id}-${timestamp}`, 'workflow.yaml');
    const reportPath = path.join(workflowRoot, '.reports', `${validatedDefinition.id}-${timestamp}.yaml`);

    await mkdir(path.dirname(backupPath), { recursive: true });
    await copyFile(loaded.workflowFile, backupPath);

    await writeTextFileAtomic(loaded.workflowFile, stringifyYaml(validatedDefinition));
    await this.loader.resolve(validatedDefinition.id);

    const report: WorkflowEditReport = {
      command,
      workflowId: validatedDefinition.id,
      targetPath: toWorkspaceRelative(this.workspaceRoot, loaded.workflowFile),
      backupPath: toWorkspaceRelative(this.workspaceRoot, backupPath),
      beforePhaseIds,
      afterPhaseIds: [...validatedDefinition.phaseOrder],
      activeTaskCompatibility: compatibility,
      validation: {
        success: true,
        message: 'Workflow schema and templates validated before and after write.',
      },
      ...(replacement !== undefined ? { replacement } : {}),
      createdAt: new Date().toISOString(),
      success: true,
    };
    await writeTextFile(reportPath, stringifyYaml(report));

    return {
      workflowId: validatedDefinition.id,
      targetPath: report.targetPath,
      backupPath: report.backupPath,
      reportPath: toWorkspaceRelative(this.workspaceRoot, reportPath),
      beforePhaseIds,
      afterPhaseIds: [...validatedDefinition.phaseOrder],
    };
  }

  private async checkActiveTaskCompatibility(
    workflowId: string,
    nextPhaseIds: string[]
  ): Promise<WorkflowEditReport['activeTaskCompatibility']> {
    const activeTasks = await this.taskStore.listActiveTasks();
    const matchingTasks = activeTasks.filter((task) => task.workflow === workflowId);
    const blockingTaskIds = matchingTasks
      .filter((task): task is TaskSummary & { currentPhase: string } => (
        task.currentPhase !== null && !nextPhaseIds.includes(task.currentPhase)
      ))
      .map((task) => task.id);

    return {
      compatible: blockingTaskIds.length === 0,
      checkedTaskIds: matchingTasks.map((task) => task.id),
      blockingTaskIds,
    };
  }

  private async validateTemplatePath(templateDir: string, templatePath: string): Promise<void> {
    if (path.isAbsolute(templatePath)) {
      throw new Error(`Workflow template path must be relative: ${templatePath}`);
    }
    const resolved = path.resolve(templateDir, templatePath);
    const relative = path.relative(templateDir, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`Workflow template path escapes templates directory: ${templatePath}`);
    }
    try {
      await access(resolved);
    } catch {
      throw new Error(`Workflow template not found: ${templatePath}`);
    }
  }
}

function cloneWorkflowDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return WorkflowDefinitionSchema.parse(parseYaml(stringifyYaml(definition)) as unknown);
}

function createFilesystemTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function toWorkspaceRelative(workspaceRoot: string, filePath: string): string {
  return path.relative(workspaceRoot, filePath).split(path.sep).join(path.posix.sep);
}
