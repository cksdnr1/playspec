import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lockfile from 'proper-lockfile';
import { execa } from 'execa';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { LockTimeoutError } from '#core/errors.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../../tsconfig.json');

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function initWorkspaceWithTask(taskId = 'phase_two_task') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title: 'Phase Two Task',
    workflowType: 'multi-spec',
  });

  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

  await execa('git', ['init'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.email', 'playspec@example.com'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.name', 'PlaySpec Test'], { cwd: workspace.dir });
  await execa('git', ['add', '.'], { cwd: workspace.dir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: workspace.dir });

  return { store, taskId };
}

describe('Phase 2 completion engine', () => {
  it('renders the current active phase when currentPhase is set', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    await store.updateTask(taskId, { currentPhase: '2' });

    const core = new PlaySpecCore(workspace.dir, store);
    const prompt = await core.renderNextPrompt(taskId);

    expect(prompt).toContain('Phase 2');
  });

  it('completes the current phase, writes artifacts, and advances state', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    const core = new PlaySpecCore(workspace.dir, store);

    const result = await core.completePhase(taskId, { withReview: true });

    expect(result.completedPhase).toBe('1');
    expect(result.nextPhase).toBe('2');
    expect(result.reviewFile).toBe('reviews/phase1_review.yaml');

    const updatedTask = await store.getTask(taskId);
    expect(updatedTask.currentPhase).toBe('2');
    expect(updatedTask.status).toBe('active');
    expect(updatedTask.phaseHistory).toContainEqual(
      expect.objectContaining({
        phase: '1',
        status: 'completed',
        reviewFile: 'reviews/phase1_review.yaml',
      })
    );

    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'snapshots', 'phase1_before_complete.yaml'))
    ).resolves.not.toThrow();
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'snapshots', 'phase1_prompt.md'))
    ).resolves.not.toThrow();
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'evidence', 'phase1_git_status.txt'))
    ).resolves.not.toThrow();
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'reviews', 'phase1_review.yaml'))
    ).resolves.not.toThrow();
  });

  it('creates manual evidence and snapshot artifacts without phase mutation', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    const core = new PlaySpecCore(workspace.dir, store);

    const evidence = await core.collectEvidence(taskId);
    const snapshot = await core.createSnapshot(taskId);
    const task = await store.getTask(taskId);

    expect(evidence.evidenceFiles).toEqual([
      'evidence/phase1_manual_git_status.txt',
      'evidence/phase1_manual_git_diff_stat.txt',
      'evidence/phase1_manual_changed_files.txt',
    ]);
    expect(snapshot.snapshotFiles).toEqual([
      'snapshots/phase1_manual_task.yaml',
    ]);
    expect(task.currentPhase).toBeNull();
    expect(task.phaseHistory).toEqual([]);
  });

  it('marks the task completed on the final workflow phase', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    await store.updateTask(taskId, { currentPhase: '5' });

    const core = new PlaySpecCore(workspace.dir, store);
    const result = await core.completePhase(taskId);
    const task = await store.getTask(taskId);

    expect(result.completedPhase).toBe('5');
    expect(result.nextPhase).toBeNull();
    expect(task.status).toBe('completed');
    expect(task.currentPhase).toBeNull();
  });

  it('fails clearly when the task lock is already held', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    const core = new PlaySpecCore(workspace.dir, store);
    const taskRoot = path.join(
      workspace.dir,
      '.playspec',
      'tasks',
      'active',
      taskId
    );

    const release = await lockfile.lock(taskRoot, {
      realpath: false,
      stale: 5000,
    });

    try {
      await expect(core.completePhase(taskId)).rejects.toThrow(LockTimeoutError);
    } finally {
      await release();
    }
  });

  it('rejects HEAD-based next on a completed task via the CLI', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    await store.updateTask(taskId, {
      status: 'completed',
      currentPhase: null,
    });

    const { stdout, stderr, exitCode } = await execa(
      'npx',
      [
        'tsx',
        '--tsconfig',
        TSCONFIG_PATH,
        CLI_PATH,
        'next',
      ],
      {
        cwd: workspace.dir,
        reject: false,
      }
    );

    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain(`Task "${taskId}" is not active`);
  });

  it('records the validation template reference when configured', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec.yaml'),
      `id: multi-spec
mode: linear
phaseOrder:
  - "1"
phases:
  "1":
    title: "Phase 1"
    template: multi-spec/phase_template.md
    requiredVariables:
      - FEATURE_SLUG
      - PHASE_NUMBER
      - PHASE_SPEC_FILE
      - PHASE_HANDOFF_FILE
      - TASK_ID
      - TASK_TITLE
      - WORKFLOW_TYPE
    completion:
      validationTemplate: validation/checklist.md
`
    );

    const core = new PlaySpecCore(workspace.dir, store);
    await core.completePhase(taskId, { withReview: true });

    const task = await store.getTask(taskId);
    expect(task.phaseHistory).toContainEqual(
      expect.objectContaining({
        phase: '1',
        validationTemplate: '.playspec/templates/validation/checklist.md',
      })
    );

    const reviewContent = await readFile(
      path.join(
        workspace.dir,
        '.playspec',
        'tasks',
        'active',
        taskId,
        'reviews',
        'phase1_review.yaml'
      ),
      'utf8'
    );
    expect(reviewContent).toContain('.playspec/templates/validation/checklist.md');
  });
});
