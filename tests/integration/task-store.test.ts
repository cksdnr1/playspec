import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { TaskNotFoundError, UnsafeTaskIdError } from '#core/errors.js';
import { writeTextFile } from '#utils/fs.js';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { access, mkdir } from 'node:fs/promises';
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
      workflow: 'multi-spec',
    });

    expect(task.id).toBe('my_feature');
    expect(task.title).toBe('My Feature');
    expect(task.workflow).toBe('multi-spec');
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

  it('creates and reads a task with a hyphenated task ID', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.createTask({
      id: 'alivesolution-748',
      title: 'AliveSolution 748',
      workflow: 'mono-spec',
    });

    expect(task.id).toBe('alivesolution-748');
    await expect(access(path.join(
      workspace.dir,
      '.playspec',
      'tasks',
      'active',
      'alivesolution-748',
      'task.yaml'
    ))).resolves.not.toThrow();
    await expect(store.getTask('alivesolution-748')).resolves.toMatchObject({
      id: 'alivesolution-748',
      title: 'AliveSolution 748',
    });
  });

  it('rejects unsafe task IDs before creating storage directories', async () => {
    const store = new YamlTaskStore(workspace.dir);

    await expect(store.createTask({
      id: '../outside',
      title: 'Outside Task',
      workflow: 'mono-spec',
    })).rejects.toThrow(UnsafeTaskIdError);
    await expect(access(path.join(workspace.dir, '.playspec', 'tasks', 'outside'))).rejects.toThrow();
  });

  it('throws TaskNotFoundError for unknown task', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await expect(store.getTask('nonexistent')).rejects.toThrow(TaskNotFoundError);
  });

  it('rejects traversal-style active task IDs before storage lookup', async () => {
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'tasks', 'outside', 'task.yaml'),
      `id: ../outside
title: Outside Task
workflow: mono-spec
status: active
workflowMode: linear
currentPhase: null
createdAt: "2026-05-28T00:00:00.000Z"
updatedAt: "2026-05-28T00:00:00.000Z"
paths:
  taskRoot: .playspec/tasks/outside
  projectDocRoot: docs/features/outside
variables:
  FEATURE_SLUG: outside
phaseHistory: []
`
    );
    const store = new YamlTaskStore(workspace.dir);

    await expect(store.getTask('../outside')).rejects.toThrow(UnsafeTaskIdError);
  });

  it('rejects traversal-style archived task IDs before storage lookup', async () => {
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'tasks', 'outside', 'task.yaml'),
      `id: ../outside
title: Outside Archived Task
workflow: mono-spec
status: archived
workflowMode: linear
currentPhase: null
createdAt: "2026-05-28T00:00:00.000Z"
updatedAt: "2026-05-28T00:00:00.000Z"
paths:
  taskRoot: .playspec/tasks/outside
  projectDocRoot: docs/features/outside
variables:
  FEATURE_SLUG: outside
phaseHistory: []
`
    );
    const store = new YamlTaskStore(workspace.dir);

    await expect(store.getArchivedTask('../outside')).rejects.toThrow(UnsafeTaskIdError);
  });

  it('lists active tasks', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'task_a', title: 'Task A', workflow: 'multi-spec' });
    await store.createTask({ id: 'task_b', title: 'Task B', workflow: 'mono-spec' });

    const tasks = await store.listActiveTasks();
    expect(tasks).toHaveLength(2);
    const ids = tasks.map((t) => t.id);
    expect(ids).toContain('task_a');
    expect(ids).toContain('task_b');
  });

  it('updates a task', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'my_task', title: 'My Task', workflow: 'multi-spec' });

    const updated = await store.updateTask('my_task', { currentPhase: '2' });
    expect(updated.currentPhase).toBe('2');

    const fetched = await store.getTask('my_task');
    expect(fetched.currentPhase).toBe('2');
  });

  it('creates required subdirectories', async () => {
    const { access } = await import('node:fs/promises');
    const path = await import('node:path');
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'dir_test', title: 'Dir Test', workflow: 'multi-spec' });

    const taskRoot = path.join(workspace.dir, '.playspec', 'tasks', 'active', 'dir_test');
    await expect(access(path.join(taskRoot, 'outputs'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'reviews'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'prompts'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'evidence'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'snapshots'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'rollback'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'completions'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'task.yaml'))).resolves.not.toThrow();
    await expect(access(path.join(taskRoot, 'memory.yaml'))).resolves.not.toThrow();
  });

  it('persists target and contextRefs through create/get', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.createTask({
      id: 'exec_task',
      title: 'Exec Task',
      workflow: 'phase-execution',
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

  it('persists create-time variables and source-problem context refs', async () => {
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.createTask({
      id: 'source_task',
      title: 'Source Task',
      workflow: 'mono-spec',
      variables: {
        SOURCE_PROBLEM_FILE: '.playspec/tasks/active/source_task/sources/source_problem.md',
      },
      contextRefs: [
        {
          path: '.playspec/tasks/active/source_task/sources/source_problem.md',
          role: 'source-problem',
          source: 'create',
        },
      ],
    });

    expect(task.variables.FEATURE_SLUG).toBe('source_task');
    expect(task.variables.SOURCE_PROBLEM_FILE).toBe(
      '.playspec/tasks/active/source_task/sources/source_problem.md'
    );

    const fetched = await store.getTask('source_task');
    expect(fetched.contextRefs).toContainEqual({
      path: '.playspec/tasks/active/source_task/sources/source_problem.md',
      role: 'source-problem',
      source: 'create',
    });
  });

  it('loads task YAML without target or contextRefs', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const taskRoot = path.join(workspace.dir, '.playspec', 'tasks', 'active', 'legacy_task');
    await mkdir(taskRoot, { recursive: true });
    await writeFile(
      path.join(taskRoot, 'task.yaml'),
      `id: legacy_task
title: Legacy Task
workflow: multi-spec
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
    await store.createTask({ id: 'active_task', title: 'Active Task', workflow: 'multi-spec' });
    await store.createTask({ id: 'done_task', title: 'Done Task', workflow: 'multi-spec' });
    // Mark done_task as completed
    await store.updateTask('done_task', { status: 'completed' });

    const completed = await store.listCompletedTasks();
    const ids = completed.map((t) => t.id);
    expect(ids).toContain('done_task');
    expect(ids).not.toContain('active_task');
  });

  it('archives a completed task into canonical archive storage', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'done_task', title: 'Done Task', workflow: 'mono-spec' });
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', 'done_task', 'outputs', 'result.md'),
      'done'
    );
    await store.updateTask('done_task', { status: 'completed' });

    const archived = await store.archiveCompletedTask('done_task');

    expect(archived.status).toBe('archived');
    expect(archived.paths.taskRoot).toBe('.playspec/tasks/archived/done_task');
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', 'done_task'))
    ).rejects.toThrow();
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'archived', 'done_task', 'outputs', 'result.md'))
    ).resolves.toBeUndefined();

    const fetched = await store.getArchivedTask('done_task');
    expect(fetched.status).toBe('archived');
    expect(fetched.paths.taskRoot).toBe('.playspec/tasks/archived/done_task');
  });

  it('rejects archiving an active task', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'active_task', title: 'Active Task', workflow: 'mono-spec' });

    await expect(store.archiveCompletedTask('active_task')).rejects.toThrow(
      'is not completed'
    );
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', 'active_task', 'task.yaml'))
    ).resolves.toBeUndefined();
  });

  it('rejects archive destination collisions before moving the task', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'done_task', title: 'Done Task', workflow: 'mono-spec' });
    await store.updateTask('done_task', { status: 'completed' });
    await mkdir(path.join(workspace.dir, '.playspec', 'tasks', 'archived', 'done_task'), {
      recursive: true,
    });

    await expect(store.archiveCompletedTask('done_task')).rejects.toThrow(
      'Archived task already exists'
    );
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', 'done_task', 'task.yaml'))
    ).resolves.toBeUndefined();
  });

  it('keeps active and archived task lookup separate', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'done_task', title: 'Done Task', workflow: 'mono-spec' });
    await store.updateTask('done_task', { status: 'completed' });
    await store.archiveCompletedTask('done_task');

    await expect(store.getTask('done_task')).rejects.toThrow(TaskNotFoundError);
    const active = await store.listActiveTasks();
    const completed = await store.listCompletedTasks();
    expect(active.map((task) => task.id)).not.toContain('done_task');
    expect(completed.map((task) => task.id)).not.toContain('done_task');

    const archived = await store.getArchivedTask('done_task');
    expect(archived.id).toBe('done_task');
  });

  it('lists archived tasks without mixing active or completed tasks', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'active_task', title: 'Active Task', workflow: 'mono-spec' });
    await store.createTask({ id: 'completed_task', title: 'Completed Task', workflow: 'mono-spec' });
    await store.createTask({ id: 'archived_b', title: 'Archived B', workflow: 'mono-spec' });
    await store.createTask({ id: 'archived_a', title: 'Archived A', workflow: 'multi-spec' });
    await store.updateTask('completed_task', { status: 'completed' });
    await store.updateTask('archived_b', { status: 'completed' });
    await store.updateTask('archived_a', { status: 'completed' });
    await store.archiveCompletedTask('archived_b');
    await store.archiveCompletedTask('archived_a');

    const archived = await store.listArchivedTasks();

    expect(archived.map((task) => task.id)).toEqual(['archived_a', 'archived_b']);
    expect(archived).toContainEqual({
      id: 'archived_a',
      title: 'Archived A',
      status: 'archived',
      currentPhase: null,
      workflow: 'multi-spec',
    });
    expect(archived.map((task) => task.id)).not.toContain('active_task');
    expect(archived.map((task) => task.id)).not.toContain('completed_task');
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
workflow: multi-spec
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
