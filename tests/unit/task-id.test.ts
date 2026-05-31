import { describe, expect, it } from 'vitest';
import { UnsafeTaskIdError } from '#core/errors.js';
import { assertSafeTaskId, isSafeTaskId, TASK_ID_FORMAT_DESCRIPTION } from '#utils/task-id.js';

describe('task ID validation', () => {
  it('accepts single-segment task IDs with lowercase letters, numbers, underscores, and hyphens', () => {
    expect(isSafeTaskId('alivesolution-748')).toBe(true);
    expect(isSafeTaskId('issue_786')).toBe(true);
    expect(isSafeTaskId('a1-b2_c3')).toBe(true);
  });

  it('rejects empty, path-like, and unsupported task IDs', () => {
    for (const taskId of ['', '../outside', 'scope/create', 'scope\\create', 'Feature-786', 'issue.786']) {
      expect(isSafeTaskId(taskId)).toBe(false);
      expect(() => assertSafeTaskId(taskId)).toThrow(UnsafeTaskIdError);
    }
  });

  it('documents a valid hyphenated replacement example', () => {
    expect(TASK_ID_FORMAT_DESCRIPTION).toContain('alivesolution-748');
  });
});
