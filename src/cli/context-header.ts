import type { TaskRecord } from '#core/types.js';

export function formatContextHeader(task: TaskRecord): string[] {
  const lines: string[] = [];
  lines.push(`Task: ${task.title}`);
  lines.push(`Phase: ${task.currentPhase ?? '(not started)'}`);
  if (task.target?.phaseNumber !== undefined) {
    lines.push(`Target: Phase ${task.target.phaseNumber}`);
  }
  if (task.contextRefs && task.contextRefs.length > 0) {
    lines.push(`Context: ${task.contextRefs.length} linked file(s)`);
  }
  return lines;
}
