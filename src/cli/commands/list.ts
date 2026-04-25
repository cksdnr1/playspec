import { YamlTaskStore } from '#storage/yaml-task-store.js';

export async function runList(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const tasks = await store.listActiveTasks();

  if (tasks.length === 0) {
    console.log('No active tasks.');
    return;
  }

  for (const task of tasks) {
    const phase = task.currentPhase ?? '(not started)';
    console.log(`${task.id}  [${task.status}]  phase: ${phase}  — ${task.title}`);
  }
}
