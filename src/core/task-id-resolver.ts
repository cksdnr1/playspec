import type { TaskStore } from '#storage/task-store.js';
import { AmbiguousTaskIdError, TaskIdResolutionError } from '#core/errors.js';

export interface ResolvedTaskId {
  input: string;
  taskId: string;
  matchedBy: 'exact' | 'prefix';
}

export class TaskIdResolver {
  constructor(private readonly taskStore: TaskStore) {}

  async resolve(input: string): Promise<ResolvedTaskId> {
    const taskIds = await this.listResolvableTaskIds();
    if (taskIds.includes(input)) {
      return { input, taskId: input, matchedBy: 'exact' };
    }

    const matches = taskIds.filter((taskId) => taskId.startsWith(input));
    if (matches.length === 1) {
      return { input, taskId: matches[0], matchedBy: 'prefix' };
    }
    if (matches.length > 1) {
      throw new AmbiguousTaskIdError(input, matches);
    }
    throw new TaskIdResolutionError(input);
  }

  private async listResolvableTaskIds(): Promise<string[]> {
    const [active, completed] = await Promise.all([
      this.taskStore.listActiveTasks(),
      this.taskStore.listCompletedTasks(),
    ]);
    return Array.from(new Set([...active, ...completed].map((task) => task.id))).sort();
  }
}
