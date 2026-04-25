import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, readdir } from 'node:fs/promises';
import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTempWorkspace } from './helpers/createTempWorkspace.js';
import type { TempWorkspace } from './helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { slugify } from '#utils/slug.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../tsconfig.json');

function runCli(args: string[], cwd?: string) {
  return execa('npx', ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, ...args], {
    cwd,
    reject: false,
  });
}
let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function createActiveTask(title: string, workflowType = 'multi-spec') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  const taskId = slugify(title);
  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title,
    workflowType,
  });

  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);
  return taskId;
}

async function initGitRepo(): Promise<void> {
  await execa('git', ['init'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.email', 'playspec@example.com'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.name', 'PlaySpec Test'], { cwd: workspace.dir });
  await execa('git', ['add', '.'], { cwd: workspace.dir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: workspace.dir });
}

describe('CLI placeholder', () => {
  it('prints help output when invoked with --help', async () => {
    const result = await runCli(['--help']);
    // --help exits with 0, output goes to stdout
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/playspec/i);
  });

  it('renders the next prompt for the active task via the CLI', async () => {
    await createActiveTask('Feature Name');

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('feature_name');
    expect(result.stdout).toContain('Feature Name');
    expect(result.stdout).toContain('Phase 1');
    expect(result.stdout).toContain('Global Rules');
    expect(result.stdout).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('renders an explicit phase prompt via the CLI', async () => {
    await createActiveTask('Feature Name');

    const result = await runCli(['phase', '3'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('feature_name');
    expect(result.stdout).toContain('Feature Name');
    expect(result.stdout).toContain('Phase 3');
    expect(result.stdout).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('reports the missing template path via the CLI when rendering fails', async () => {
    await createActiveTask('Broken Template Task');
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec.yaml'),
      `id: multi-spec
mode: linear
phaseOrder:
  - "1"
phases:
  "1":
    title: "Phase 1"
    template: missing/phase_template.md
`
    );

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Template file not found');
    expect(result.stderr).toContain(
      path.join(
        workspace.dir,
        '.playspec',
        'templates',
        'missing',
        'phase_template.md'
      )
    );
    expect(result.stderr).toContain('Re-run `playspec init` if needed.');
  });

  it('completes the current phase and writes review artifacts via the CLI', async () => {
    const taskId = await createActiveTask('CLI Complete Task');
    await initGitRepo();

    const result = await runCli(['complete', '--with-review'], workspace.dir);
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Completed phase 1');
    expect(task.currentPhase).toBe('2');
    expect(task.phaseHistory).toContainEqual(
      expect.objectContaining({
        phase: '1',
        status: 'completed',
        reviewFile: 'reviews/phase1_review.yaml',
      })
    );
    await expect(
      access(
        path.join(
          workspace.dir,
          '.playspec',
          'tasks',
          'active',
          taskId,
          'reviews',
          'phase1_review.yaml'
        )
      )
    ).resolves.not.toThrow();
  });

  it('marks the task completed on the final workflow phase via the CLI', async () => {
    const taskId = await createActiveTask('CLI Final Phase Task');
    await initGitRepo();
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, { currentPhase: '5' });

    const result = await runCli(['complete'], workspace.dir);
    const task = await store.getTask(taskId);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Completed phase 5');
    expect(result.stdout).toContain('Task status: completed');
    expect(result.stdout).not.toContain('Review file:');
    expect(task.status).toBe('completed');
    expect(task.currentPhase).toBeNull();
    expect(task.phaseHistory).toContainEqual(
      expect.objectContaining({
        phase: '5',
        status: 'completed',
      })
    );
    await expect(
      access(
        path.join(
          workspace.dir,
          '.playspec',
          'tasks',
          'active',
          taskId,
          'reviews',
          'phase5_review.yaml'
        )
      )
    ).rejects.toThrow();
  });

  it('creates evidence and snapshot artifacts via the CLI without phase mutation', async () => {
    const taskId = await createActiveTask('CLI Artifact Task');
    await initGitRepo();
    const store = new YamlTaskStore(workspace.dir);

    const evidenceResult = await runCli(['evidence'], workspace.dir);
    const snapshotResult = await runCli(['snapshot'], workspace.dir);
    const task = await store.getTask(taskId);

    expect(evidenceResult.exitCode).toBe(0);
    expect(snapshotResult.exitCode).toBe(0);
    expect(evidenceResult.stdout).toContain('Collected evidence for phase 1');
    expect(snapshotResult.stdout).toContain('Created snapshot for phase 1');
    expect(task.currentPhase).toBeNull();
    expect(task.phaseHistory).toEqual([]);
    const evidenceFiles = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'evidence')
    );
    const snapshotFiles = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'snapshots')
    );

    expect(evidenceFiles.some((file) => file.startsWith('phase1'))).toBe(true);
    expect(snapshotFiles.some((file) => file.startsWith('phase1'))).toBe(true);
  });

  it('reports desync details via the CLI', async () => {
    const taskId = await createActiveTask('CLI Desync Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 2;\n');

    const result = await runCli(['desync-check'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Task: ${taskId}`);
    expect(result.stdout).toContain('Severity: medium');
    expect(result.stdout).toContain('src/app.ts');
  });

  it('reports untracked files through desync-check', async () => {
    await createActiveTask('CLI Untracked Desync Task');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'untracked.ts'), 'export const value = 1;\n');

    const result = await runCli(['desync-check'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Severity: medium');
    expect(result.stdout).toContain('Untracked files: src/untracked.ts');
  });

  it('prints a high desync warning before next prompt output', async () => {
    await createActiveTask('CLI Next Desync Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 2;\n');
    await execa('git', ['add', 'src/app.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'source change'], { cwd: workspace.dir });

    const result = await runCli(['next'], workspace.dir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('High desync warning');
    expect(result.stdout.indexOf('High desync warning')).toBeLessThan(
      result.stdout.indexOf('Phase 2')
    );
  });

  it('restores task state with rollback --state-only and leaves source files untouched', async () => {
    const taskId = await createActiveTask('CLI Rollback Task');
    const sourcePath = path.join(workspace.dir, 'src', 'app.ts');
    await writeTextFile(sourcePath, 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await runCli(['snapshot'], workspace.dir);

    const result = await runCli(['rollback', '--state-only'], workspace.dir);
    const store = new YamlTaskStore(workspace.dir);
    const task = await store.getTask(taskId);
    const activeSnapshots = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'snapshots')
    );
    const quarantineRoot = path.join(
      workspace.dir,
      '.playspec',
      'tasks',
      'active',
      taskId,
      'rollback'
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('State-only rollback restored task.yaml');
    expect(task.currentPhase).toBeNull();
    expect(task.phaseHistory).toEqual([]);
    expect(task.stateSync?.lastKnownGitHead).toEqual(task.rollback?.lastSafePoint?.gitHead);
    expect(task.stateSync?.lastCompletedAt).toEqual(task.rollback?.lastSafePoint?.createdAt);
    await expect(access(sourcePath)).resolves.not.toThrow();
    expect(activeSnapshots).not.toContain('phase2_manual_task.yaml');
    await expect(
      access(path.join(quarantineRoot, task.rollback?.lastSafePoint?.id ?? '', 'snapshots', 'phase2_manual_task.yaml'))
    ).resolves.not.toThrow();
  });

  it('blocks confirmed git rollback when tracked source files are dirty', async () => {
    await createActiveTask('CLI Dirty Rollback Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 2;\n');

    const result = await runCli(['rollback', '--git-only', '--confirm'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Git rollback is blocked');
    expect(result.stderr).toContain('state-only');
  });

  it('prints rollback preview output by default and with --git-only', async () => {
    await createActiveTask('CLI Rollback Preview Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);

    const defaultPreview = await runCli(['rollback'], workspace.dir);
    const gitOnlyPreview = await runCli(['rollback', '--git-only'], workspace.dir);

    for (const result of [defaultPreview, gitOnlyPreview]) {
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Safe point:');
      expect(result.stdout).toContain('Git rollback eligible: yes');
      expect(result.stdout).toContain('Confirm command: playspec rollback --git-only --confirm');
    }
  });

  it('blocks confirmed git rollback when new commits exist after the safe point', async () => {
    await createActiveTask('CLI New Commit Rollback Task');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await writeTextFile(path.join(workspace.dir, 'src', 'new-commit.ts'), 'export const value = 1;\n');
    await execa('git', ['add', 'src/new-commit.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'new commit after safe point'], { cwd: workspace.dir });

    const result = await runCli(['rollback', '--git-only', '--confirm'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Git rollback is blocked');
    expect(result.stderr).toContain('New commits exist after the rollback safe point.');
  });

  it('blocks confirmed git rollback when untracked files conflict with rollback targets', async () => {
    await createActiveTask('CLI Untracked Rollback Task');
    const sourcePath = path.join(workspace.dir, 'src', 'app.ts');
    await writeTextFile(sourcePath, 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);
    await execa('git', ['rm', 'src/app.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'delete tracked file after safe point'], { cwd: workspace.dir });
    await writeTextFile(sourcePath, 'export const value = 2;\n');

    const result = await runCli(['rollback', '--git-only', '--confirm'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Git rollback is blocked');
    expect(result.stderr).toContain('Untracked files conflict with rollback target files and will not be deleted.');
  });

  it('executes confirmed git rollback when safety gates pass', async () => {
    await createActiveTask('CLI Clean Git Rollback Task');
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await initGitRepo();
    await runCli(['complete'], workspace.dir);

    const preview = await runCli(['rollback', '--git-only'], workspace.dir);
    const result = await runCli(['rollback', '--git-only', '--confirm'], workspace.dir);

    expect(preview.exitCode).toBe(0);
    expect(preview.stdout).toContain('Confirm command: playspec rollback --git-only --confirm');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Git rollback executed from the last safe point');
  });

  it('rejects HEAD-based phase rendering for completed tasks via the CLI', async () => {
    const taskId = await createActiveTask('Completed Phase Task');
    const store = new YamlTaskStore(workspace.dir);
    await store.updateTask(taskId, {
      status: 'completed',
      currentPhase: null,
    });

    const result = await runCli(['phase', '1'], workspace.dir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`Task "${taskId}" is not active`);
  });
});
