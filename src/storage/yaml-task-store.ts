import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { TaskRecordSchema } from '../core/schemas.js';
import { TaskNotFoundError } from '../core/errors.js';
import type { TaskStore } from './task-store.js';
import type { TaskRecord, TaskSummary, CreateTaskInput } from '../core/types.js';
import { readTextFile, writeTextFile } from '../utils/fs.js';
import { getTasksRoot, getTaskRoot } from '../utils/paths.js';

export class YamlTaskStore implements TaskStore {
  private readonly tasksRoot: string;

  constructor(private readonly workspaceRoot: string) {
    this.tasksRoot = getTasksRoot(workspaceRoot);
  }

  private taskYamlPath(taskId: string): string {
    return path.join(getTaskRoot(this.workspaceRoot, taskId), 'task.yaml');
  }

  async getTask(taskId: string): Promise<TaskRecord> {
    const yamlPath = this.taskYamlPath(taskId);
    let content: string;
    try {
      content = await readTextFile(yamlPath);
    } catch {
      throw new TaskNotFoundError(taskId);
    }
    const raw = parseYaml(content) as unknown;
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
      entries = await readdir(this.tasksRoot);
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
          });
        }
      } catch {
        // Skip unreadable entries
      }
    }
    return summaries;
  }

  async createTask(input: CreateTaskInput): Promise<TaskRecord> {
    const now = new Date().toISOString();
    const taskRoot = path.join('.playspec', 'tasks', 'active', input.id);
    const projectDocRoot = path.join('docs', 'features', input.id);

    const task: TaskRecord = {
      id: input.id,
      title: input.title,
      workflowType: input.workflowType,
      status: 'active',
      workflowMode: 'linear',
      currentPhase: null,
      createdAt: now,
      updatedAt: now,
      paths: {
        taskRoot,
        projectDocRoot,
      },
      variables: {
        FEATURE_SLUG: input.id,
      },
      phaseHistory: [],
    };

    // Create task directory structure
    const absoluteTaskRoot = getTaskRoot(this.workspaceRoot, input.id);
    await mkdir(path.join(absoluteTaskRoot, 'outputs'), { recursive: true });
    await mkdir(path.join(absoluteTaskRoot, 'reviews'), { recursive: true });
    await mkdir(path.join(absoluteTaskRoot, 'prompts'), { recursive: true });

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
    await this.saveTask(updated);
    return updated;
  }
}
