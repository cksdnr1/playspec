import { NoActiveTaskError } from './errors.js';
import type { TaskRecord } from './types.js';
import type { TaskStore } from '../storage/task-store.js';
import { readTextFile } from '../utils/fs.js';
import { getHeadPath } from '../utils/paths.js';

export class ActiveTaskResolver {
  constructor(
    private readonly workspaceRoot: string,
    private readonly taskStore: TaskStore
  ) {}

  /**
   * Resolve a TaskRecord.
   * - If taskId is provided, fetch it directly.
   * - Otherwise read .playspec/HEAD for the current task ID.
   * - Throws NoActiveTaskError if HEAD is empty or missing.
   */
  async resolveTask(taskId?: string): Promise<TaskRecord> {
    if (taskId) {
      return this.taskStore.getTask(taskId);
    }

    const headPath = getHeadPath(this.workspaceRoot);
    let headContent: string;
    try {
      headContent = await readTextFile(headPath);
    } catch {
      throw new NoActiveTaskError();
    }

    const resolvedId = headContent.trim();
    if (!resolvedId) {
      throw new NoActiveTaskError();
    }

    return this.taskStore.getTask(resolvedId);
  }
}
