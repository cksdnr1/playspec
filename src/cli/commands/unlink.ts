import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { InvalidTaskLinkTypeError } from '#core/errors.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import type { TaskLinkType } from '#core/types.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';

export interface UnlinkOptions {
  as?: string;
  to?: string;
}

export async function runUnlink(
  workspaceRoot: string,
  sourceArg: string | undefined,
  targetArg: string | undefined,
  options: UnlinkOptions
): Promise<void> {
  if (options.to !== undefined && (sourceArg !== undefined || targetArg !== undefined)) {
    throw new Error('Use either `playspec unlink <sourceTaskId> <targetTaskId>` or `playspec unlink --to <targetTaskId>`, not both.');
  }
  const type = parseOptionalLinkType(options.as);
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new TaskIdResolver(store);
  const sourceTaskId = await resolveSourceTaskId(workspaceRoot, store, resolver, sourceArg, options.to);
  const targetInput = options.to ?? targetArg;
  if (!targetInput) {
    throw new Error('Target task is required. Use `playspec unlink <sourceTaskId> <targetTaskId>` or `playspec unlink --to <targetTaskId>`.');
  }

  const target = await resolver.resolve(targetInput);
  if (target.matchedBy === 'prefix') {
    console.log(`Resolved ${target.input} -> ${target.taskId}`);
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const result = await core.removeTaskLink(sourceTaskId, target.taskId, type);
  if (result.warning) {
    console.warn(`Warning: ${result.warning}`);
    return;
  }
  const typeLabel = type ? ` ${type}` : '';
  console.log(`Unlinked${typeLabel} ${result.sourceTaskId} -> ${result.targetTaskId}`);
}

async function resolveSourceTaskId(
  workspaceRoot: string,
  store: YamlTaskStore,
  resolver: TaskIdResolver,
  sourceArg: string | undefined,
  toOption: string | undefined
): Promise<string> {
  if (toOption !== undefined) {
    const task = await new ActiveTaskResolver(workspaceRoot, store).resolveTask();
    return task.id;
  }
  if (!sourceArg) {
    throw new Error('Source task is required unless --to is used. Run `playspec use <taskId>` or pass source explicitly.');
  }
  const source = await resolver.resolve(sourceArg);
  if (source.matchedBy === 'prefix') {
    console.log(`Resolved ${source.input} -> ${source.taskId}`);
  }
  return source.taskId;
}

function parseOptionalLinkType(input: string | undefined): TaskLinkType | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input !== 'parent' && input !== 'after' && input !== 'related') {
    throw new InvalidTaskLinkTypeError(input);
  }
  return input;
}
