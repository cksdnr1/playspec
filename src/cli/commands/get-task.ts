import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { resolveEffectivePhaseDisplay } from '../cli-utils.js';

export async function runGetTask(workspaceRoot: string, taskId: string, json?: boolean): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const task = await store.getTask(taskId);

  if (json) {
    console.log(JSON.stringify(task, null, 2));
    return;
  }

  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const eph = await resolveEffectivePhaseDisplay(task, workflowLoader);
  const contextRefsCount = task.contextRefs?.length ?? 0;

  console.log(`ID:           ${task.id}`);
  console.log(`Title:        ${task.title}`);
  console.log(`Workflow:     ${task.workflow}`);
  console.log(`Status:       ${task.status}`);
  console.log(`Phase:       ${eph.phaseDisplay}`);
  if (eph.phaseIdDisplay) {
    console.log(`Phase ID:    ${eph.phaseIdDisplay}`);
  }
  console.log(`Context refs: ${contextRefsCount}`);
}
