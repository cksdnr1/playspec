import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import type { DesyncCheckResult } from '#core/types.js';

export async function runDesyncCheck(
  workspaceRoot: string,
  taskIdOption?: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);
  const core = new PlaySpecCore(workspaceRoot, store);
  const result = await core.checkTaskDesync(task.id);

  printDesyncResult(result);
}

export function printDesyncResult(result: DesyncCheckResult): void {
  console.log(`Task: ${result.taskId}`);
  console.log(`Severity: ${result.severity}`);
  console.log(`Last known Git HEAD: ${result.lastKnownGitHead ?? 'none'}`);
  console.log(`Current Git HEAD: ${result.currentGitHead ?? 'none'}`);
  printList('Changed files', result.changedFiles);
  printList('Deleted files', result.deletedFiles);
  printList('Renamed files', result.renamedFiles);
  printList('Untracked files', result.untrackedFiles);
  printList('Reasons', result.reasons);
  console.log(`Recommended action: ${result.recommendedAction}`);
}

function printList(label: string, values: string[]): void {
  console.log(`${label}: ${values.length > 0 ? values.join(', ') : 'none'}`);
}
