import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { formatContextRef, resolveEffectivePhaseDisplay } from '../cli-utils.js';

export async function runCurrentTask(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask();

  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const eph = await resolveEffectivePhaseDisplay(task, workflowLoader);

  const contextRefsCount = task.contextRefs?.length ?? 0;

  console.log(`ID:           ${task.id}`);
  console.log(`Title:        ${task.title}`);
  console.log(`Workflow:     ${task.workflowType}`);
  console.log(`Status:       ${task.status}`);
  console.log(`${`${eph.phaseLabel}:`.padEnd(13)}${eph.phaseDisplay}`);
  if (eph.phaseIdDisplay) {
    console.log(`Step ID:      ${eph.phaseIdDisplay}`);
  }
  if (eph.gateRouteLines.length > 0) {
    console.log('Gate:');
    for (const line of eph.gateRouteLines) console.log(line);
  }
  if (eph.nextRouteLines.length > 0) {
    console.log('Next:');
    for (const line of eph.nextRouteLines) console.log(line);
  }
  console.log(`Context refs: ${contextRefsCount}`);
  console.log(`Docs root:    ${task.paths.projectDocRoot}`);
  if (task.contextRefs && task.contextRefs.length > 0) {
    console.log('Context refs detail:');
    for (const ref of task.contextRefs) {
      console.log(`- ${formatContextRef(ref)}`);
    }
  }
}
