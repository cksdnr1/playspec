import { UnsafeTaskIdError } from '#core/errors.js';

export const TASK_ID_PATTERN = /^[a-z0-9_]+$/;

export function isSafeTaskId(taskId: string): boolean {
  return TASK_ID_PATTERN.test(taskId);
}

export function assertSafeTaskId(taskId: string): void {
  if (!isSafeTaskId(taskId)) {
    throw new UnsafeTaskIdError(taskId);
  }
}
