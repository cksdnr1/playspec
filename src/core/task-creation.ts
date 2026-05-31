import { access } from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceNotInitializedError, SelfTaskLinkError } from '#core/errors.js';
import { assertRequiredVariables } from '#core/required-variables.js';
import type { ResolvedWorkflow, TaskContextRef, TaskLink, TaskRecord } from '#core/types.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { mergeVariableDeclarations, VariableResolver } from '#template/variable-resolver.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';
import { getHeadPath, getPlayspecRoot } from '#utils/paths.js';
import { slugify } from '#utils/slug.js';
import { assertSafeTaskId } from '#utils/task-id.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { TaskIdResolver } from './task-id-resolver.js';

export interface CreateNormalTaskInput {
  title: string;
  workflow: string;
  taskId?: string;
  variables?: Record<string, string>;
  sourceProblemText?: string;
  sourceProblemFile?: string;
  sourceProblemMethod?: string;
  parentTaskId?: string;
  afterTaskId?: string;
  linkCreatedBy?: TaskLink['createdBy'];
}

export interface CreateNormalTaskResult {
  task: TaskRecord;
  taskId: string;
  title: string;
  workflow: string;
  sourceProblemFile?: string;
  variables: Record<string, string>;
  contextRefs?: TaskContextRef[];
  links?: TaskLink[];
}

interface SourceResult {
  relativePath: string;
  content: string;
  method: string;
}

export async function createNormalTask(
  workspaceRoot: string,
  input: CreateNormalTaskInput
): Promise<CreateNormalTaskResult> {
  const playspecRoot = getPlayspecRoot(workspaceRoot);
  try {
    await access(playspecRoot);
  } catch {
    throw new WorkspaceNotInitializedError(workspaceRoot);
  }

  await validateWorkflowExists(workspaceRoot, input.workflow);

  const taskId = input.taskId ?? slugify(input.title);
  assertSafeTaskId(taskId);

  const variables = normalizeVariables(input.variables);
  const source = await resolveSourceProblem(workspaceRoot, taskId, input);
  const links = await resolveCreateLinks(workspaceRoot, taskId, input);
  const taskVariables = source
    ? { ...variables, SOURCE_PROBLEM_FILE: source.relativePath }
    : variables;
  const contextRefs: TaskContextRef[] | undefined = source
    ? [{ path: source.relativePath, role: 'source-problem', source: source.method }]
    : undefined;

  await assertInitialPhaseRequiredVariables(workspaceRoot, {
    id: taskId,
    title: input.title,
    workflow: input.workflow,
    variables: taskVariables,
    contextRefs,
    links,
  });

  const store = new YamlTaskStore(workspaceRoot);
  const task = await store.createTask({
    id: taskId,
    title: input.title,
    workflow: input.workflow,
    variables: taskVariables,
    contextRefs,
    links,
  });
  if (source) {
    await writeTextFile(path.join(workspaceRoot, source.relativePath), source.content);
  }
  await writeTextFile(getHeadPath(workspaceRoot), `${task.id}\n`);

  return {
    task,
    taskId: task.id,
    title: task.title,
    workflow: task.workflow,
    sourceProblemFile: source?.relativePath,
    variables,
    contextRefs,
    links,
  };
}

async function validateWorkflowExists(workspaceRoot: string, workflow: string): Promise<ResolvedWorkflow> {
  return new WorkflowLoader(workspaceRoot).resolve(workflow);
}

function normalizeVariables(variables: Record<string, string> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables ?? {})) {
    if (typeof value !== 'string') {
      throw new Error(`Invalid variable "${key}". MCP task variables must be strings.`);
    }
    normalized[key] = value;
  }
  return normalized;
}

async function resolveSourceProblem(
  workspaceRoot: string,
  taskId: string,
  input: Pick<CreateNormalTaskInput, 'sourceProblemText' | 'sourceProblemFile' | 'sourceProblemMethod'>
): Promise<SourceResult | undefined> {
  const activeModes = [
    input.sourceProblemText !== undefined,
    input.sourceProblemFile !== undefined,
  ].filter(Boolean);

  if (activeModes.length > 1) {
    throw new Error('Use only one source input: sourceProblemText or sourceProblemFile.');
  }

  let content: string | undefined;
  let method = input.sourceProblemMethod ?? 'create';
  if (input.sourceProblemText !== undefined) {
    content = input.sourceProblemText;
  } else if (input.sourceProblemFile !== undefined) {
    const sourcePath = path.resolve(workspaceRoot, input.sourceProblemFile);
    content = await readTextFile(sourcePath);
    method = input.sourceProblemMethod ?? 'create';
  } else {
    return undefined;
  }

  if (content === undefined || !content.trim()) {
    return undefined;
  }

  return {
    relativePath: path.join('.playspec', 'tasks', 'active', taskId, 'sources', 'source_problem.md'),
    content: content.endsWith('\n') ? content : `${content}\n`,
    method,
  };
}

async function resolveCreateLinks(
  workspaceRoot: string,
  newTaskId: string,
  input: Pick<CreateNormalTaskInput, 'parentTaskId' | 'afterTaskId' | 'linkCreatedBy'>
): Promise<TaskLink[] | undefined> {
  const requested = [
    input.parentTaskId ? { type: 'parent' as const, taskId: input.parentTaskId } : undefined,
    input.afterTaskId ? { type: 'after' as const, taskId: input.afterTaskId } : undefined,
  ].filter((value): value is { type: 'parent' | 'after'; taskId: string } => value !== undefined);

  if (requested.length === 0) {
    return undefined;
  }

  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new TaskIdResolver(store);
  const createdAt = new Date().toISOString();
  const links: TaskLink[] = [];

  for (const request of requested) {
    const resolved = await resolver.resolve(request.taskId);
    if (resolved.taskId === newTaskId) {
      throw new SelfTaskLinkError(newTaskId);
    }
    links.push({
      type: request.type,
      targetTaskId: resolved.taskId,
      createdAt,
      createdBy: input.linkCreatedBy,
    });
  }

  return links;
}

async function assertInitialPhaseRequiredVariables(
  workspaceRoot: string,
  input: {
    id: string;
    title: string;
    workflow: string;
    variables: Record<string, string>;
    contextRefs?: TaskContextRef[];
    links?: TaskLink[];
  }
): Promise<void> {
  const workflow = await new WorkflowLoader(workspaceRoot).resolve(input.workflow);
  const task = createTaskPreview(input);
  const { phaseId, definition } = new PhaseResolver().resolveCurrentPhase(task, workflow.definition);
  const variables = new VariableResolver().resolve(task, phaseId, workflow.definition, definition);
  const declarations = mergeVariableDeclarations(workflow.definition.variables, definition.variables);

  assertRequiredVariables(workflow.id, phaseId, definition, declarations, variables);
}

function createTaskPreview(input: {
  id: string;
  title: string;
  workflow: string;
  variables: Record<string, string>;
  contextRefs?: TaskContextRef[];
  links?: TaskLink[];
}): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: input.id,
    title: input.title,
    workflow: input.workflow,
    status: 'active',
    workflowMode: 'linear',
    currentPhase: null,
    createdAt: now,
    updatedAt: now,
    paths: {
      taskRoot: path.join('.playspec', 'tasks', 'active', input.id),
      projectDocRoot: path.join('docs', 'features', input.id),
    },
    variables: {
      FEATURE_SLUG: input.id,
      ...input.variables,
    },
    phaseHistory: [],
    stateSync: {
      lastKnownGitHead: null,
      lastCompletedAt: null,
    },
    rollback: {
      lastSafePoint: null,
    },
    ...(input.contextRefs !== undefined ? { contextRefs: input.contextRefs } : {}),
    ...(input.links !== undefined ? { links: input.links } : {}),
  };
}
