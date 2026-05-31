import { UnsafeTaskIdError } from '#core/errors.js';

export const TASK_ID_FORMAT_DESCRIPTION =
  'Use 1 or more lowercase letters, numbers, underscores, or hyphens with no path separators. Example: alivesolution-748.';

export const TASK_ID_PATTERN = /^[a-z0-9_-]+$/;

export function isSafeTaskId(taskId: string): boolean {
  return TASK_ID_PATTERN.test(taskId);
}

export function assertSafeTaskId(taskId: string): void {
  if (!isSafeTaskId(taskId)) {
    throw new UnsafeTaskIdError(taskId);
  }
}
