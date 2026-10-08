import type { TaskStore } from './task-store.js';
import type { CompletionEvent } from '#core/types.js';
import { CompletionTransactionStore } from './completion-transaction-store.js';
import { assertSafeTaskId } from '#utils/task-id.js';
import { getActiveTaskRoot } from '#utils/paths.js';
import { withWriteLock } from '#utils/fs.js';

/** Hold across recovery and the complete read/modify/write interval. */
export function withTaskMutationLock<T>(workspaceRoot: string, store: TaskStore, taskId: string,
  action: (recovered?: CompletionEvent) => Promise<T>): Promise<T> {
  assertSafeTaskId(taskId);
  return withWriteLock(getActiveTaskRoot(workspaceRoot, taskId), async () =>
    action(await new CompletionTransactionStore(workspaceRoot, store).recover(taskId)));
}
