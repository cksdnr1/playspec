import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { readHeadTaskId } from '../cli-utils.js';

export async function runList(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const tasks = await store.listActiveTasks();
  const headTaskId = await readHeadTaskId(workspaceRoot);

  if (tasks.length === 0) {
    console.log('No active tasks.');
    return;
  }

  for (const task of tasks) {
    const phase = task.currentPhase ?? '(not started)';
    const marker = task.id === headTaskId ? ' [HEAD]' : '';
    console.log(`${task.id}${marker}  [${task.status}]  phase: ${phase}  — ${task.title}`);
  }
}
