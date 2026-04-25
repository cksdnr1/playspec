import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { InvalidRollbackOptionsError } from '#core/errors.js';
import type { RollbackExecutionResult, RollbackPlanResult } from '#core/types.js';

export interface RollbackCliOptions {
  task?: string;
  stateOnly?: boolean;
  gitOnly?: boolean;
  confirm?: boolean;
}

export async function runRollback(
  workspaceRoot: string,
  options: RollbackCliOptions
): Promise<void> {
  if (options.stateOnly && options.gitOnly) {
    throw new InvalidRollbackOptionsError();
  }

  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(options.task);
  const core = new PlaySpecCore(workspaceRoot, store);

  if (options.stateOnly) {
    printExecutionResult(await core.rollbackStateOnly(task.id));
    return;
  }

  if (options.gitOnly && options.confirm) {
    printExecutionResult(await core.executeGitRollback(task.id));
    return;
  }

  const plan = await core.planRollback(task.id);
  printRollbackPlan(plan);
}

export function printRollbackPlan(plan: RollbackPlanResult): void {
  console.log(`Task: ${plan.taskId}`);
  console.log(`Safe point: ${plan.safePoint.id}`);
  console.log(`Safe point phase: ${plan.safePoint.phase}`);
  console.log(`Last known Git HEAD: ${plan.lastKnownGitHead ?? 'none'}`);
  console.log(`Current Git HEAD: ${plan.currentGitHead ?? 'none'}`);
  printList('Changed files', plan.changedFiles);
  printList('Deleted files', plan.deletedFiles);
  printList('Renamed files', plan.renamedFiles);
  printList('Untracked files', plan.untrackedFiles);
  printList('Affected commits', plan.affectedCommits);
  console.log(`Git rollback eligible: ${plan.canExecuteGitRollback ? 'yes' : 'no'}`);
  printList('Safety reasons', plan.safetyReasons);
  console.log(`Recommended action: ${plan.recommendedAction}`);
  if (plan.confirmCommand) {
    console.log(`Confirm command: ${plan.confirmCommand}`);
  }
}

function printExecutionResult(result: RollbackExecutionResult): void {
  console.log(result.message);
  console.log(`Task: ${result.taskId}`);
  console.log(`Mode: ${result.mode}`);
  if (result.restoredSnapshotFile) {
    console.log(`Restored snapshot: ${result.restoredSnapshotFile}`);
  }
  if (result.quarantinedFiles) {
    printList('Quarantined files', result.quarantinedFiles);
  }
  if (result.plan) {
    printRollbackPlan(result.plan);
  }
}

function printList(label: string, values: string[]): void {
  console.log(`${label}: ${values.length > 0 ? values.join(', ') : 'none'}`);
}
