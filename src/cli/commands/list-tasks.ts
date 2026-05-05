import { access } from 'node:fs/promises';
import { WorkspaceNotInitializedError } from '#core/errors.js';
import type { TaskSummary } from '#core/types.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { getPlayspecRoot } from '#utils/paths.js';
import { readHeadTaskId, resolveEffectivePhaseDisplay } from '../cli-utils.js';

function orderTasksForDisplay(tasks: TaskSummary[], headTaskId: string | null): TaskSummary[] {
  if (!headTaskId) {
    return tasks;
  }

  const headTask = tasks.find((task) => task.id === headTaskId);
  if (!headTask) {
    return tasks;
  }

  return [headTask, ...tasks.filter((task) => task.id !== headTaskId)];
}

export async function runListTasks(workspaceRoot: string): Promise<void> {
  try {
    await access(getPlayspecRoot(workspaceRoot));
  } catch {
    throw new WorkspaceNotInitializedError(workspaceRoot);
  }

  const store = new YamlTaskStore(workspaceRoot);
  const tasks = await store.listActiveTasks();
  const headTaskId = await readHeadTaskId(workspaceRoot);

  if (tasks.length === 0) {
    console.log('No active tasks.');
    return;
  }

  const workflowLoader = new WorkflowLoader(workspaceRoot);
  console.log('Task ID  Workflow  Phase  Title');

  for (const task of orderTasksForDisplay(tasks, headTaskId)) {
    const eph = await resolveEffectivePhaseDisplay(task, workflowLoader);
    const marker = task.id === headTaskId ? ' [HEAD]' : '';
    console.log(`${task.id}${marker}  [${task.workflow}]  phase: ${eph.phaseDisplay}  — ${task.title}`);
  }
}
