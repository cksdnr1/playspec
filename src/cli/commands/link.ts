import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { InvalidTaskLinkTypeError } from '#core/errors.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import type { TaskLinkType } from '#core/types.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';

export interface LinkOptions {
  as?: string;
  to?: string;
}

export async function runLink(
  workspaceRoot: string,
  sourceArg: string | undefined,
  targetArg: string | undefined,
  options: LinkOptions
): Promise<void> {
  const type = parseLinkType(options.as);
  if (options.to !== undefined && (sourceArg !== undefined || targetArg !== undefined)) {
    throw new Error('Use either `playspec link <sourceTaskId> <targetTaskId> --as <type>` or `playspec link --to <targetTaskId> --as <type>`, not both.');
  }
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new TaskIdResolver(store);
  const sourceTaskId = await resolveSourceTaskId(workspaceRoot, store, resolver, sourceArg, options.to);
  const targetInput = options.to ?? targetArg;
  if (!targetInput) {
    throw new Error('Target task is required. Use `playspec link <sourceTaskId> <targetTaskId> --as parent` or `playspec link --to <targetTaskId> --as parent`.');
  }

  const target = await resolver.resolve(targetInput);
  if (target.matchedBy === 'prefix') {
    console.log(`Resolved ${target.input} -> ${target.taskId}`);
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const result = await core.addTaskLink(sourceTaskId, target.taskId, type);
  if (result.warning) {
    console.warn(`Warning: ${result.warning}`);
    return;
  }
  console.log(`Linked ${result.sourceTaskId} --${type}--> ${result.targetTaskId}`);
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

function parseLinkType(input: string | undefined): TaskLinkType {
  if (!input) {
    throw new Error('Link type is required. Use --as parent, --as after, or --as related.');
  }
  if (input !== 'parent' && input !== 'after' && input !== 'related') {
    throw new InvalidTaskLinkTypeError(input);
  }
  return input;
}
