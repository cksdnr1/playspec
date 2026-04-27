import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { readHeadTaskId, resolveEffectivePhaseDisplay } from '../cli-utils.js';

export async function runListTasks(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const tasks = await store.listActiveTasks();
  const headTaskId = await readHeadTaskId(workspaceRoot);

  if (tasks.length === 0) {
    console.log('No active tasks.');
    return;
  }

  const workflowLoader = new WorkflowLoader(workspaceRoot);

  for (const task of tasks) {
    const eph = await resolveEffectivePhaseDisplay(task, workflowLoader);
    const marker = task.id === headTaskId ? ' [HEAD]' : '';
    console.log(`${task.id}${marker}  [${task.workflowType}]  phase: ${eph.phaseDisplay}  — ${task.title}`);
  }
}
