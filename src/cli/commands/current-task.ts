import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { formatGateRoutes, gateResults, phaseDisplayInfo } from '#workflow/phase-display.js';
import { formatContextRef } from '../cli-utils.js';

export async function runCurrentTask(workspaceRoot: string): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask();

  const workflowLoader = new WorkflowLoader(workspaceRoot);

  let phaseDisplay = task.currentPhase ?? '(not started)';
  let phaseLabel = 'Phase';
  let phaseIdDisplay = '';
  let gateRouteLines: string[] = [];
  if (task.currentPhase !== null) {
    try {
      const workflow = await workflowLoader.load(task.workflowType);
      const definition = workflow.phases[task.currentPhase];
      if (definition) {
        const display = phaseDisplayInfo(task.currentPhase, definition);
        if (definition.stepNumber) {
          phaseLabel = 'Step';
          phaseDisplay = display.label;
        } else {
          phaseDisplay = `${display.id} — ${display.title}`;
        }
        if (definition.stepNumber) {
          phaseIdDisplay = display.id;
        }
        if (definition.stepNumber && gateResults(definition).length > 0) {
          gateRouteLines = formatGateRoutes(workflow, definition);
        }
      }
    } catch {
      // leave phase metadata minimal if workflow fails to load
    }
  }

  const contextRefsCount = task.contextRefs?.length ?? 0;

  console.log(`ID:           ${task.id}`);
  console.log(`Title:        ${task.title}`);
  console.log(`Workflow:     ${task.workflowType}`);
  console.log(`Status:       ${task.status}`);
  console.log(`${`${phaseLabel}:`.padEnd(13)}${phaseDisplay}`);
  if (phaseIdDisplay) {
    console.log(`Step ID:      ${phaseIdDisplay}`);
  }
  if (gateRouteLines.length > 0) {
    console.log('Gate:');
    for (const line of gateRouteLines) {
      console.log(line);
    }
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
