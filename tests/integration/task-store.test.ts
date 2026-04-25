import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { TaskNotFoundError } from '#core/errors.js';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

describe('YamlTaskStore', () => {
  it('creates a task and reads it back', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.createTask({
      id: 'my_feature',
      title: 'My Feature',
      workflowType: 'multi-spec',
    });

    expect(task.id).toBe('my_feature');
    expect(task.title).toBe('My Feature');
    expect(task.workflowType).toBe('multi-spec');
    expect(task.status).toBe('active');
    expect(task.currentPhase).toBeNull();

    const fetched = await store.getTask('my_feature');
    expect(fetched.id).toBe('my_feature');
    expect(fetched.title).toBe('My Feature');
  });

  it('throws TaskNotFoundError for unknown task', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await expect(store.getTask('nonexistent')).rejects.toThrow(TaskNotFoundError);
  });

  it('lists active tasks', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'task_a', title: 'Task A', workflowType: 'multi-spec' });
    await store.createTask({ id: 'task_b', title: 'Task B', workflowType: 'mono-spec' });

    const tasks = await store.listActiveTasks();
    expect(tasks).toHaveLength(2);
    const ids = tasks.map((t) => t.id);
    expect(ids).toContain('task_a');
    expect(ids).toContain('task_b');
  });

  it('updates a task', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'my_task', title: 'My Task', workflowType: 'multi-spec' });

    const updated = await store.updateTask('my_task', { currentPhase: '2' });
    expect(updated.currentPhase).toBe('2');

    const fetched = await store.getTask('my_task');
    expect(fetched.currentPhase).toBe('2');
  });

  it('creates required subdirectories', async () => {
    const { access } = await import('node:fs/promises');
    const path = await import('node:path');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'dir_test', title: 'Dir Test', workflowType: 'multi-spec' });

    const taskRoot = path.join(workspace.dir, '.playspec', 'tasks', 'active', 'dir_test');
    await expect(access(path.join(taskRoot, 'outputs'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'reviews'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'prompts'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'task.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'memory.yaml'))).resolves.not.toThrow();
  });
});
