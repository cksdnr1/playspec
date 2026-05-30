import { access, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { TaskRecordSchema } from '#core/schemas.js';
import {
  ArchivedTaskAlreadyExistsError,
  TaskAlreadyExistsError,
  TaskNotCompletedError,
  TaskNotFoundError,
} from '#core/errors.js';
import type { TaskStore } from './task-store.js';
import type {
  TaskRecord,
  TaskSummary,
  CreateTaskInput,
  CompletePhaseInput,
  PhaseHistoryEntry,
} from '#core/types.js';
import { readTextFile, writeTextFile, writeTextFileAtomic } from '#utils/fs.js';
import {
  getActiveTaskRoot,
  getActiveTasksRoot,
  getArchivedTaskRoot,
  getArchivedTasksRoot,
} from '#utils/paths.js';
import { assertSafeTaskId } from '#utils/task-id.js';

export class YamlTaskStore implements TaskStore {
  private readonly activeTasksRoot: string;

  constructor(private readonly workspaceRoot: string) {
    this.activeTasksRoot = getActiveTasksRoot(workspaceRoot);
  }

  private taskYamlPath(taskId: string): string {
    assertSafeTaskId(taskId);
    return path.join(getActiveTaskRoot(this.workspaceRoot, taskId), 'task.yaml');
  }

  private archivedTaskYamlPath(taskId: string): string {
    assertSafeTaskId(taskId);
    return path.join(getArchivedTaskRoot(this.workspaceRoot, taskId), 'task.yaml');
  }

  async getTask(taskId: string): Promise<TaskRecord> {
    const yamlPath = this.taskYamlPath(taskId);
    let content: string;
    try {
      content = await readTextFile(yamlPath);
    } catch {
      throw new TaskNotFoundError(taskId);
    }
    const raw = normalizeLegacyTask(parseYaml(content) as unknown);
    return TaskRecordSchema.parse(raw);
  }

  async getArchivedTask(taskId: string): Promise<TaskRecord> {
    const yamlPath = this.archivedTaskYamlPath(taskId);
    let content: string;
    try {
      content = await readTextFile(yamlPath);
    } catch {
      throw new TaskNotFoundError(taskId);
    }
    const raw = normalizeLegacyTask(parseYaml(content) as unknown);
    return TaskRecordSchema.parse(raw);
  }

  async saveTask(task: TaskRecord): Promise<void> {
    const validated = TaskRecordSchema.parse(task);
    const yamlPath = this.taskYamlPath(validated.id);
    await writeTextFile(yamlPath, stringifyYaml(validated));
  }

  async listActiveTasks(): Promise<TaskSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(this.activeTasksRoot);
    } catch {
      return [];
    }

    const summaries: TaskSummary[] = [];
    for (const entry of entries) {
      try {
        const task = await this.getTask(entry);
        if (task.status === 'active') {
          summaries.push({
            id: task.id,
            title: task.title,
            status: task.status,
            currentPhase: task.currentPhase,
            workflow: task.workflow,
          });
        }
      } catch {
        // Skip unreadable entries
      }
    }
    return summaries;
  }

  async listCompletedTasks(): Promise<TaskSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(this.activeTasksRoot);
    } catch {
      return [];
    }

    const summaries: TaskSummary[] = [];
    for (const entry of entries) {
      try {
        const task = await this.getTask(entry);
        if (task.status === 'completed') {
          summaries.push({
            id: task.id,
            title: task.title,
            status: task.status,
            currentPhase: task.currentPhase,
            workflow: task.workflow,
          });
        }
      } catch {
        // Skip unreadable entries
      }
    }
    return summaries;
  }

  async listArchivedTasks(): Promise<TaskSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(getArchivedTasksRoot(this.workspaceRoot));
    } catch {
      return [];
    }

    const summaries: TaskSummary[] = [];
    for (const entry of entries) {
      try {
        const task = await this.getArchivedTask(entry);
        if (task.status === 'archived') {
          summaries.push({
            id: task.id,
            title: task.title,
            status: task.status,
            currentPhase: task.currentPhase,
            workflow: task.workflow,
          });
        }
      } catch {
        // Skip unreadable entries
      }
    }
    return summaries.sort((a, b) => a.id.localeCompare(b.id));
  }

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const absoluteTaskRoot = getActiveTaskRoot(this.workspaceRoot, input.id);
    if (await pathExists(absoluteTaskRoot)) {
      throw new TaskAlreadyExistsError(input.id);
    }

    const now = new Date().toISOString();
    const taskRoot = path.join('.playspec', 'tasks', 'active', input.id);
    const projectDocRoot = path.join('docs', 'features', input.id);

    const task: TaskRecord = {
      id: input.id,
      title: input.title,
      workflow: input.workflow,
      status: 'active',
      workflowMode: 'linear',
      currentPhase: input.currentPhase ?? null,
      createdAt: now,
      updatedAt: now,
      paths: {
        taskRoot,
        projectDocRoot,
      },
      variables: {
        FEATURE_SLUG: input.id,
        ...(input.variables ?? {}),
      },
      phaseHistory: [],
      stateSync: {
        lastKnownGitHead: null,
        lastCompletedAt: null,
      },
      rollback: {
        lastSafePoint: null,
      },
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.contextRefs !== undefined ? { contextRefs: input.contextRefs } : {}),
      ...(input.links !== undefined ? { links: input.links } : {}),
    };

    // Create task directory structure
    await mkdir(path.join(absoluteTaskRoot, 'outputs'), { recursive: true });
    await mkdir(path.join(absoluteTaskRoot, 'reviews'), { recursive: true });
    await mkdir(path.join(absoluteTaskRoot, 'prompts'), { recursive: true });
    await mkdir(path.join(absoluteTaskRoot, 'evidence'), { recursive: true });
    await mkdir(path.join(absoluteTaskRoot, 'snapshots'), { recursive: true });
    await mkdir(path.join(absoluteTaskRoot, 'rollback'), { recursive: true });
    await mkdir(path.join(absoluteTaskRoot, 'completions'), { recursive: true });

    // Write task.yaml
    await writeTextFile(
      path.join(absoluteTaskRoot, 'task.yaml'),
      stringifyYaml(task)
    );

    // Write empty memory.yaml
    await writeTextFile(
      path.join(absoluteTaskRoot, 'memory.yaml'),
      stringifyYaml({})
    );

    return task;
  }

  async updateTask(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord> {
    const existing = await this.getTask(taskId);
    const updated: TaskRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const validated = TaskRecordSchema.parse(updated);
    const yamlPath = this.taskYamlPath(taskId);
    await writeTextFileAtomic(yamlPath, stringifyYaml(validated));
    return validated;
  }

  async completePhase(
    taskId: string,
    input: CompletePhaseInput
  ): Promise<TaskRecord> {
    const existing = await this.getTask(taskId);
    const now = input.stateSync?.lastCompletedAt ?? new Date().toISOString();
    const phaseHistory = this.buildPhaseHistory(existing.phaseHistory, input, now);

    const updated: TaskRecord = {
      ...existing,
      status: input.nextPhase === null ? 'completed' : 'active',
      currentPhase: input.nextPhase,
      updatedAt: now,
      phaseHistory,
      stateSync: input.stateSync ?? existing.stateSync,
      rollback: input.rollback ?? existing.rollback,
    };

    const validated = TaskRecordSchema.parse(updated);
    const yamlPath = this.taskYamlPath(taskId);
    await writeTextFileAtomic(yamlPath, stringifyYaml(validated));
    return validated;
  }

  async archiveCompletedTask(taskId: string): Promise<TaskRecord> {
    assertSafeTaskId(taskId);
    const existing = await this.getTask(taskId);
    if (existing.status !== 'completed') {
      throw new TaskNotCompletedError(taskId, existing.status);
    }

    const activeRoot = getActiveTaskRoot(this.workspaceRoot, taskId);
    const archivedRoot = getArchivedTaskRoot(this.workspaceRoot, taskId);
    const archivedTasksRoot = getArchivedTasksRoot(this.workspaceRoot);

    if (await pathExists(archivedRoot)) {
      throw new ArchivedTaskAlreadyExistsError(taskId);
    }

    await mkdir(archivedTasksRoot, { recursive: true });
    await rename(activeRoot, archivedRoot);

    const archived: TaskRecord = {
      ...existing,
      status: 'archived',
      updatedAt: new Date().toISOString(),
      paths: {
        ...existing.paths,
        taskRoot: path.join('.playspec', 'tasks', 'archived', taskId),
      },
    };
    const validated = TaskRecordSchema.parse(archived);
    await writeTextFileAtomic(
      path.join(archivedRoot, 'task.yaml'),
      stringifyYaml(validated)
    );
    return validated;
  }

  private buildPhaseHistory(
    existingHistory: PhaseHistoryEntry[],
    input: CompletePhaseInput,
    completedAt: string
  ): PhaseHistoryEntry[] {
    // Drop stale active entries; retain all completed entries (including repeated visits)
    const retainedHistory = existingHistory.filter((entry) => entry.status !== 'active');

    const newEntry: PhaseHistoryEntry = {
      phase: input.phaseId,
      status: 'completed',
      completedAt,
      reviewFile: input.reviewFile,
      evidenceFiles: input.evidenceFiles,
      snapshotFiles: input.snapshotFiles,
      validationTemplate: input.validationTemplate,
    };

    if (input.result !== undefined) {
      newEntry.result = input.result;
    }
    if (input.visitCount !== undefined) {
      newEntry.visitCount = input.visitCount;
    }

    retainedHistory.push(newEntry);
    return retainedHistory;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeLegacyTask(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record['workflow'] !== 'string' && typeof record['workflowType'] === 'string') {
    return {
      ...record,
      workflow: record['workflowType'],
    };
  }
  return raw;
}
