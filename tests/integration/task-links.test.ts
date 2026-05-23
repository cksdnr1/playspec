import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { readFile } from 'node:fs/promises';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { TaskIdResolver } from '#core/task-id-resolver.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../../tsconfig.json');
const TSX_PATH = path.resolve(TESTS_DIR, '../../node_modules/.bin/tsx');

let workspace: TempWorkspace;

vi.setConfig({ testTimeout: 60_000 });

function runCli(args: string[]) {
  return execa(TSX_PATH, ['--tsconfig', TSCONFIG_PATH, CLI_PATH, ...args], {
    cwd: workspace.dir,
    reject: false,
  });
}

async function initWorkspace(): Promise<void> {
  await new PresetManager().initWorkspace(workspace.dir, 'default');
}

async function readTaskYaml(taskId: string): Promise<Record<string, unknown>> {
  const content = await readFile(
    path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'task.yaml'),
    'utf8'
  );
  return parseYaml(content) as Record<string, unknown>;
}

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

describe('lightweight task links', () => {
  it('persists optional links and keeps legacy tasks without links valid', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'parent_task', title: 'Parent Task', workflow: 'multi-spec' });
    await store.createTask({
      id: 'child_task',
      title: 'Child Task',
      workflow: 'multi-spec',
      links: [
        {
          type: 'parent',
          targetTaskId: 'parent_task',
          createdAt: '2026-05-05T00:00:00.000Z',
          createdBy: 'cli',
        },
      ],
    });

    expect((await store.getTask('parent_task')).links).toBeUndefined();
    expect((await store.getTask('child_task')).links).toEqual([
      {
        type: 'parent',
        targetTaskId: 'parent_task',
        createdAt: '2026-05-05T00:00:00.000Z',
        createdBy: 'cli',
      },
    ]);
  });

  it('resolves exact IDs, unique prefixes, ambiguity, and missing IDs', async () => {
    const store = new YamlTaskStore(workspace.dir);
    await store.createTask({ id: 'issue_84_parent', title: 'Parent', workflow: 'multi-spec' });
    await store.createTask({ id: 'issue_84_phase_one', title: 'Phase One', workflow: 'multi-spec' });
    await store.createTask({ id: 'issue_84_phase_two', title: 'Phase Two', workflow: 'multi-spec' });
    await store.createTask({ id: 'issue_84_done', title: 'Done', workflow: 'multi-spec' });
    await store.updateTask('issue_84_done', { status: 'completed' });

    const resolver = new TaskIdResolver(store);
    await expect(resolver.resolve('issue_84_parent')).resolves.toMatchObject({
      taskId: 'issue_84_parent',
      matchedBy: 'exact',
    });
    await expect(resolver.resolve('issue_84_pare')).resolves.toMatchObject({
      taskId: 'issue_84_parent',
      matchedBy: 'prefix',
    });
    await expect(resolver.resolve('issue_84_done')).resolves.toMatchObject({
      taskId: 'issue_84_done',
      matchedBy: 'exact',
    });
    await expect(resolver.resolve('issue_84_phase')).rejects.toThrow('Ambiguous task ID prefix');
    await expect(resolver.resolve('missing')).rejects.toThrow('No task found matching');
  });

  it('creates parent and after links from create flags without adding related to create', async () => {
    await initWorkspace();
    await runCli(['create', 'Issue 84 Parent', '--workflow', 'multi-spec']);
    await runCli(['create', 'Issue 84 Phase One', '--workflow', 'multi-spec', '--parent', 'issue_84_parent']);
    const result = await runCli([
      'create',
      'Issue 84 Phase Two',
      '--workflow',
      'multi-spec',
      '--parent',
      'issue_84_parent',
      '--after',
      'issue_84_phase_one',
    ]);
    const help = await runCli(['create', '--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created task:');
    expect(result.stdout).toContain('ID: issue_84_phase_two');
    expect(help.stdout).not.toContain('--related');

    const yaml = await readTaskYaml('issue_84_phase_two');
    expect(yaml['links']).toMatchObject([
      { type: 'parent', targetTaskId: 'issue_84_parent', createdBy: 'cli' },
      { type: 'after', targetTaskId: 'issue_84_phase_one', createdBy: 'cli' },
    ]);
    expect((await readTaskYaml('issue_84_parent'))['links']).toBeUndefined();
  });

  it('links and unlinks with explicit source and current-task shorthand', async () => {
    await initWorkspace();
    await runCli(['create', 'Issue 84 Parent', '--workflow', 'multi-spec']);
    await runCli(['create', 'Issue 84 Child', '--workflow', 'multi-spec']);
    await runCli(['use', 'issue_84_child']);

    const shorthand = await runCli(['link', '--to', 'issue_84_parent', '--as', 'parent']);
    const duplicate = await runCli(['link', 'issue_84_child', 'issue_84_parent', '--as', 'parent']);
    const explicit = await runCli(['link', 'issue_84_child', 'issue_84_parent', '--as', 'related']);
    const unlinkRelated = await runCli(['unlink', 'issue_84_child', 'issue_84_parent', '--as', 'related']);
    const missing = await runCli(['unlink', 'issue_84_child', 'issue_84_parent', '--as', 'related']);
    const secondType = await runCli(['link', 'issue_84_child', 'issue_84_parent', '--as', 'related']);
    const unlinkAll = await runCli(['unlink', 'issue_84_child', 'issue_84_parent']);
    const invalid = await runCli(['link', 'issue_84_child', 'issue_84_parent', '--as', 'blocks']);
    const mixedLink = await runCli(['link', 'issue_84_child', 'issue_84_parent', '--to', 'issue_84_parent', '--as', 'parent']);
    const mixedUnlink = await runCli(['unlink', 'issue_84_child', 'issue_84_parent', '--to', 'issue_84_parent']);

    expect(shorthand.exitCode).toBe(0);
    expect(shorthand.stdout).toContain('Linked issue_84_child --parent--> issue_84_parent');
    expect(duplicate.stderr).toContain('Warning: Link already exists');
    expect(explicit.stdout).toContain('Linked issue_84_child --related--> issue_84_parent');
    expect(unlinkRelated.stdout).toContain('Unlinked related issue_84_child -> issue_84_parent');
    expect(missing.stderr).toContain('Warning: No related link exists');
    expect(secondType.stdout).toContain('Linked issue_84_child --related--> issue_84_parent');
    expect(unlinkAll.stdout).toContain('Unlinked issue_84_child -> issue_84_parent');
    expect(invalid.exitCode).not.toBe(0);
    expect(invalid.stderr).toContain('Invalid task link type');
    expect(mixedLink.exitCode).not.toBe(0);
    expect(mixedLink.stderr).toContain('Use either `playspec link <sourceTaskId> <targetTaskId>');
    expect(mixedUnlink.exitCode).not.toBe(0);
    expect(mixedUnlink.stderr).toContain('Use either `playspec unlink <sourceTaskId> <targetTaskId>');

    const yaml = await readTaskYaml('issue_84_child');
    expect(yaml['links']).toBeUndefined();
  });

  it('rejects explicit link and unlink mutations when the source task is completed', async () => {
    await initWorkspace();
    await runCli(['create', 'Issue 84 Parent', '--workflow', 'multi-spec']);
    await runCli(['create', 'Issue 84 Child', '--workflow', 'multi-spec']);

    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask('issue_84_child', { status: 'completed' });

    const beforeLink = await readTaskYaml('issue_84_child');
    const link = await runCli(['link', 'issue_84_child', 'issue_84_parent', '--as', 'parent']);
    const afterLink = await readTaskYaml('issue_84_child');

    expect(link.exitCode).not.toBe(0);
    expect(link.stderr).toContain('Task "issue_84_child" is not active (status: completed).');
    expect(afterLink).toEqual(beforeLink);

    await store.updateTask('issue_84_child', {
      status: 'active',
      links: [
        {
          type: 'parent',
          targetTaskId: 'issue_84_parent',
          createdAt: '2026-05-23T00:00:00.000Z',
          createdBy: 'cli',
        },
      ],
    });
    await store.updateTask('issue_84_child', { status: 'completed' });

    const beforeUnlink = await readTaskYaml('issue_84_child');
    const unlink = await runCli(['unlink', 'issue_84_child', 'issue_84_parent']);
    const afterUnlink = await readTaskYaml('issue_84_child');

    expect(unlink.exitCode).not.toBe(0);
    expect(unlink.stderr).toContain('Task "issue_84_child" is not active (status: completed).');
    expect(afterUnlink).toEqual(beforeUnlink);
  });

  it('rejects current-task shorthand link and unlink mutations when HEAD is completed', async () => {
    await initWorkspace();
    await runCli(['create', 'Issue 84 Parent', '--workflow', 'multi-spec']);
    await runCli(['create', 'Issue 84 Child', '--workflow', 'multi-spec']);
    await runCli(['use', 'issue_84_child']);

    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask('issue_84_child', { status: 'completed' });

    const beforeLink = await readTaskYaml('issue_84_child');
    const link = await runCli(['link', '--to', 'issue_84_parent', '--as', 'parent']);
    const afterLink = await readTaskYaml('issue_84_child');

    expect(link.exitCode).not.toBe(0);
    expect(link.stderr).toContain('Task "issue_84_child" is not active (status: completed).');
    expect(afterLink).toEqual(beforeLink);

    await store.updateTask('issue_84_child', {
      status: 'active',
      links: [
        {
          type: 'parent',
          targetTaskId: 'issue_84_parent',
          createdAt: '2026-05-23T00:00:00.000Z',
          createdBy: 'cli',
        },
      ],
    });
    await store.updateTask('issue_84_child', { status: 'completed' });

    const beforeUnlink = await readTaskYaml('issue_84_child');
    const unlink = await runCli(['unlink', '--to', 'issue_84_parent']);
    const afterUnlink = await readTaskYaml('issue_84_child');

    expect(unlink.exitCode).not.toBe(0);
    expect(unlink.stderr).toContain('Task "issue_84_child" is not active (status: completed).');
    expect(afterUnlink).toEqual(beforeUnlink);
  });

  it('rejects self-links and ambiguous prefixes', async () => {
    await initWorkspace();
    await runCli(['create', 'Issue 84 Parent', '--workflow', 'multi-spec']);
    await runCli(['create', 'Issue 84 Phase One', '--workflow', 'multi-spec']);
    await runCli(['create', 'Issue 84 Phase Two', '--workflow', 'multi-spec']);

    const self = await runCli(['link', 'issue_84_parent', 'issue_84_parent', '--as', 'related']);
    const ambiguous = await runCli(['link', 'issue_84_parent', 'issue_84_phase', '--as', 'after']);
    const createSelf = await runCli(['create', 'Issue 84 Parent', '--workflow', 'multi-spec', '--parent', 'issue_84_parent']);

    expect(self.exitCode).not.toBe(0);
    expect(self.stderr).toContain('cannot link to itself');
    expect(ambiguous.exitCode).not.toBe(0);
    expect(ambiguous.stderr).toContain('Ambiguous task ID prefix');
    expect(ambiguous.stderr).toContain('Use a longer task ID prefix');
    expect(createSelf.exitCode).not.toBe(0);
    expect(createSelf.stderr).toContain('cannot link to itself');
  });

  it('renders direct status relationships and suggested next candidates', async () => {
    await initWorkspace();
    await runCli(['create', 'Issue 84 Parent', '--workflow', 'multi-spec']);
    await runCli(['create', 'Issue 84 Phase One', '--workflow', 'multi-spec', '--parent', 'issue_84_parent']);
    await runCli([
      'create',
      'Issue 84 Phase Two',
      '--workflow',
      'multi-spec',
      '--parent',
      'issue_84_parent',
      '--after',
      'issue_84_phase_one',
    ]);
    await runCli(['create', 'Issue 84 Phase Three', '--workflow', 'multi-spec', '--parent', 'issue_84_parent']);
    await runCli(['link', 'issue_84_parent', 'issue_84_phase_one', '--as', 'related']);

    const parentStatus = await runCli(['status', 'issue_84_parent', '--quiet']);
    const phaseOneStatus = await runCli(['status', 'issue_84_phase_one', '--quiet']);
    const childStatus = await runCli(['status', 'issue_84_phase_two', '--quiet']);

    expect(parentStatus.stdout).toContain('Includes:');
    expect(parentStatus.stdout).toContain('issue_84_phase_one (active)');
    expect(parentStatus.stdout).toContain('issue_84_phase_two (active)');
    expect(parentStatus.stdout).toContain('issue_84_phase_three (active)');
    expect(parentStatus.stdout).toContain('Related:');
    expect(parentStatus.stdout).toContain('issue_84_phase_one');
    expect(parentStatus.stdout).toContain('Open candidates:');
    expect(parentStatus.stdout).toContain('issue_84_phase_one (active)');
    expect(parentStatus.stdout).toContain('issue_84_phase_three (active)');
    expect(phaseOneStatus.stdout).toContain('Followed by:');
    expect(phaseOneStatus.stdout).toContain('issue_84_phase_two (active)');
    expect(phaseOneStatus.stdout).toContain('Related by:');
    expect(phaseOneStatus.stdout).toContain('issue_84_parent (active)');
    expect(childStatus.stdout).toContain('Parents:');
    expect(childStatus.stdout).toContain('issue_84_parent');
    expect(childStatus.stdout).toContain('After:');
    expect(childStatus.stdout).toContain('issue_84_phase_one');
  });

  it('adds linked task context to prompts only for linked tasks', async () => {
    await initWorkspace();
    await runCli(['create', 'Issue 84 Parent', '--workflow', 'multi-spec']);
    const parentPrompt = await runCli(['prompt', '--task', 'issue_84_parent', '--print-only', '--quiet']);
    await runCli(['create', 'Issue 84 Previous', '--workflow', 'multi-spec']);
    await runCli(['create', 'Issue 84 Child', '--workflow', 'multi-spec', '--parent', 'issue_84_parent', '--after', 'issue_84_previous']);
    await runCli(['link', 'issue_84_child', 'issue_84_previous', '--as', 'related']);
    const childPrompt = await runCli(['prompt', '--task', 'issue_84_child', '--print-only', '--quiet']);

    expect(parentPrompt.stdout).not.toContain('Linked task context:');
    expect(childPrompt.stdout).toContain('Linked task context:');
    expect(childPrompt.stdout).toContain('Parents:');
    expect(childPrompt.stdout).toContain('- issue_84_parent');
    expect(childPrompt.stdout).toContain('After:');
    expect(childPrompt.stdout).toContain('- issue_84_previous');
    expect(childPrompt.stdout).toContain('Related:');
  });
});
