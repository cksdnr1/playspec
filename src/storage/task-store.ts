import type { TaskRecord, TaskSummary, CreateTaskInput } from '../core/types.js';

export interface TaskStore {
  getTask(taskId: string): Promise<TaskRecord>;
  saveTask(task: TaskRecord): Promise<void>;
  listActiveTasks(): Promise<TaskSummary[]>;
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  updateTask(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord>;
}
