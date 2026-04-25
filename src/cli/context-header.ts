import type { TaskRecord } from '#core/types.js';

export function formatContextHeader(task: TaskRecord): string[] {
  const lines: string[] = [];
  lines.push(`Task: ${task.title}`);
  lines.push(`Phase: ${task.currentPhase ?? '(not started)'}`);
  return lines;
}
