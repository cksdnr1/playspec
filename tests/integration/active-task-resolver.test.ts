import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { NoActiveTaskError, TaskNotFoundError } from '#core/errors.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath, getPlayspecRoot } from '#utils/paths.js';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
  // Minimal .playspec structure so YamlTaskStore can create tasks
  await mkdir(path.join(workspace.dir, '.playspec', 'tasks', 'active'), { recursive: true });
});

afterEach(async () => {
  await workspace.cleanup();
});

describe('ActiveTaskResolver', () => {
  it('resolves task by explicit taskId without reading HEAD', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'my_task', title: 'My Task', workflowType: 'multi-spec' });

    const resolver = new ActiveTaskResolver(workspace.dir, store);
    const task = await resolver.resolveTask('my_task');

    expect(task.id).toBe('my_task');
    expect(task.title).toBe('My Task');
  });

  it('resolves task from HEAD when no taskId is given', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'head_task', title: 'Head Task', workflowType: 'multi-spec' });
    await writeTextFile(getHeadPath(workspace.dir), 'head_task\n');

    const resolver = new ActiveTaskResolver(workspace.dir, store);
    const task = await resolver.resolveTask();

    expect(task.id).toBe('head_task');
    expect(task.title).toBe('Head Task');
  });

  it('throws NoActiveTaskError when HEAD is empty', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await writeTextFile(getHeadPath(workspace.dir), '');

    const resolver = new ActiveTaskResolver(workspace.dir, store);
    await expect(resolver.resolveTask()).rejects.toThrow(NoActiveTaskError);
  });

  it('throws NoActiveTaskError when HEAD file does not exist', async () => {
    // Ensure HEAD does not exist — only .playspec dir exists (no HEAD file written)
    const store = new YamlTaskStore(workspace.dir);
    const resolver = new ActiveTaskResolver(workspace.dir, store);
    await expect(resolver.resolveTask()).rejects.toThrow(NoActiveTaskError);
  });

  it('propagates TaskNotFoundError when HEAD points to a missing task', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await writeTextFile(getHeadPath(workspace.dir), 'ghost_task\n');

    const resolver = new ActiveTaskResolver(workspace.dir, store);
    await expect(resolver.resolveTask()).rejects.toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError for explicit taskId that does not exist', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const resolver = new ActiveTaskResolver(workspace.dir, store);
    await expect(resolver.resolveTask('nonexistent')).rejects.toThrow(TaskNotFoundError);
  });
});
