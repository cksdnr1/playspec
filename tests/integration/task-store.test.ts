import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { TaskNotFoundError } from '#core/errors.js';
import { writeTextFile } from '#utils/fs.js';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import path from 'node:path';

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
    expect(task.stateSync).toEqual({
      lastKnownGitHead: null,
      lastCompletedAt: null,
    });
    expect(task.rollback).toEqual({
      lastSafePoint: null,
    });

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
    await expect(access(path.join(taskRoot, 'evidence'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'snapshots'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'rollback'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'task.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'memory.yaml'))).resolves.not.toThrow();
  });

  it('persists target and contextRefs through create/get', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.createTask({
      id: 'exec_task',
      title: 'Exec Task',
      workflowType: 'phase-execution',
      target: { phaseNumber: '1' },
      contextRefs: [
        { path: 'docs/features/planning/planning_total_spec.md', role: 'planning-context', source: 'planning' },
      ],
    });

    expect(task.target?.phaseNumber).toBe('1');
    expect(task.contextRefs).toHaveLength(1);
    expect(task.contextRefs![0].path).toBe('docs/features/planning/planning_total_spec.md');

    const fetched = await store.getTask('exec_task');
    expect(fetched.target?.phaseNumber).toBe('1');
    expect(fetched.contextRefs).toHaveLength(1);
    expect(fetched.contextRefs![0].role).toBe('planning-context');
    expect(fetched.contextRefs![0].source).toBe('planning');
  });

  it('loads task YAML without target or contextRefs', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const taskRoot = path.join(workspace.dir, '.playspec', 'tasks', 'active', 'legacy_task');
    await mkdir(taskRoot, { recursive: true });
    await writeFile(
      path.join(taskRoot, 'task.yaml'),
      `id: legacy_task
title: Legacy Task
workflowType: multi-spec
status: active
workflowMode: linear
currentPhase: null
createdAt: "2026-04-25T00:00:00.000Z"
updatedAt: "2026-04-25T00:00:00.000Z"
paths:
  taskRoot: .playspec/tasks/active/legacy_task
  projectDocRoot: docs/features/legacy_task
variables:
  FEATURE_SLUG: legacy_task
phaseHistory: []
`
    );

    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask('legacy_task');
    expect(task.id).toBe('legacy_task');
    expect(task.target).toBeUndefined();
    expect(task.contextRefs).toBeUndefined();
  });

  it('listCompletedTasks returns only completed tasks', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'active_task', title: 'Active Task', workflowType: 'multi-spec' });
    await store.createTask({ id: 'done_task', title: 'Done Task', workflowType: 'multi-spec' });
    // Mark done_task as completed
    await store.updateTask('done_task', { status: 'completed' });

    const completed = await store.listCompletedTasks();
    const ids = completed.map((t) => t.id);
    expect(ids).toContain('done_task');
    expect(ids).not.toContain('active_task');
  });

  it('loads pre-Phase-3 task YAML without sync or rollback metadata', async () => {
    const taskRoot = path.join(
      workspace.dir,
      '.playspec',
      'tasks',
      'active',
      'old_task'
    );
    await writeTextFile(
      path.join(taskRoot, 'task.yaml'),
      `id: old_task
title: Old Task
workflowType: multi-spec
status: active
workflowMode: linear
currentPhase: null
createdAt: "2026-04-25T00:00:00.000Z"
updatedAt: "2026-04-25T00:00:00.000Z"
paths:
  taskRoot: .playspec/tasks/active/old_task
  projectDocRoot: docs/features/old_task
variables:
  FEATURE_SLUG: old_task
phaseHistory: []
`
    );

    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask('old_task');

    expect(task.id).toBe('old_task');
    expect(task.stateSync).toBeUndefined();
    expect(task.rollback).toBeUndefined();
  });
});
