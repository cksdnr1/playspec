import type {
  TaskRecord,
  TaskSummary,
  CreateTaskInput,
  CompletePhaseInput,
} from '#core/types.js';

export interface TaskStore {
  getTask(taskId: string): Promise<TaskRecord>;
  saveTask(task: TaskRecord): Promise<void>;
  listActiveTasks(): Promise<TaskSummary[]>;
  listCompletedTasks(): Promise<TaskSummary[]>;
  createTask(input: CreateTaskInput): Promise<TaskRecord>;
  updateTask(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord>;
  completePhase(taskId: string, input: CompletePhaseInput): Promise<TaskRecord>;
}
