import chalk from 'chalk';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';

export async function runListTasks(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const tasks = await store.listActiveTasks();

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

    console.log(`${task.id}  [${task.workflowType}]  phase: ${phaseDisplay}  — ${task.title}`);
  }
}
