import chalk from 'chalk';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { readHeadTaskId } from '../cli-utils.js';

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
    let phaseDisplay: string;
    if (task.currentPhase === null) {
      phaseDisplay = '(not started)';
    } else {
      try {
        const workflow = await workflowLoader.load(task.workflowType);
        if (workflow.phaseOrder.includes(task.currentPhase)) {
          phaseDisplay = task.currentPhase;
        } else {
          phaseDisplay = chalk.red(`INVALID (${task.currentPhase})`);
        }
      } catch {
        phaseDisplay = task.currentPhase;
      }
    }

    const marker = task.id === headTaskId ? ' [HEAD]' : '';
    console.log(`${task.id}${marker}  [${task.workflowType}]  phase: ${phaseDisplay}  — ${task.title}`);
  }
}
