import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lockfile from 'proper-lockfile';
import { execa } from 'execa';
import { parse as parseYaml } from 'yaml';
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
const TSX_PATH = path.resolve(TESTS_DIR, '../../node_modules/.bin/tsx');

let workspace: TempWorkspace;
let previousUserWorkflows: string | undefined;

vi.setConfig({ testTimeout: 15_000 });

beforeEach(async () => {
  workspace = await createTempWorkspace();
  previousUserWorkflows = process.env['PLAY_SPEC_USER_WORKFLOWS'];
  process.env['PLAY_SPEC_USER_WORKFLOWS'] = path.join(workspace.dir, 'user-workflows');
});

afterEach(async () => {
  if (previousUserWorkflows === undefined) {
    delete process.env['PLAY_SPEC_USER_WORKFLOWS'];
  } else {
    process.env['PLAY_SPEC_USER_WORKFLOWS'] = previousUserWorkflows;
  }
  await workspace.cleanup();
});

async function initWorkspaceWithTask(taskId = 'phase_two_task') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title: 'Phase Two Task',
    workflow: 'multi-spec',
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
    expect(updatedTask.stateSync?.lastKnownGitHead).toMatch(/^[0-9a-f]{40}$/);
    expect(updatedTask.stateSync?.lastCompletedAt).toEqual(
      updatedTask.phaseHistory.find((entry) => entry.phase === '1')?.completedAt
    );
    expect(updatedTask.rollback?.lastSafePoint).toEqual(
      expect.objectContaining({
        phase: '1',
        gitHead: updatedTask.stateSync?.lastKnownGitHead,
        taskSnapshotFile: 'snapshots/phase1_before_complete.yaml',
        promptSnapshotFile: 'snapshots/phase1_prompt.md',
      })
    );
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
    const metadata = parseYaml(await readFile(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'snapshots', 'phase1_prompt.md.meta.yaml'),
      'utf-8'
    )) as { contextMode: string; generationSource: string; taskId: string; phaseId: string };
    expect(metadata.contextMode).toBe('compact');
    expect(metadata.generationSource).toBe('complete');
    expect(metadata.taskId).toBe(taskId);
    expect(metadata.phaseId).toBe('1');
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'evidence', 'phase1_git_status.txt'))
    ).resolves.not.toThrow();
    await expect(
      access(path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'reviews', 'phase1_review.yaml'))
    ).resolves.not.toThrow();
  });

  it('writes one completion ledger event and matching markdown for a successful completion', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    const core = new PlaySpecCore(workspace.dir, store);

    const result = await core.completePhase(taskId, { withReview: true });
    const ledger = parseYaml(await readFile(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'completions', 'index.yaml'),
      'utf-8'
    )) as { taskId: string; events: Array<{ id: string; type: string; markdownFile: string; rollbackSafePointId: string }> };
    const completionFiles = await readdir(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'completions')
    );

    expect(result.completionEvent).toMatchObject({
      id: '0001',
      sequence: 1,
      taskId,
      phase: '1',
      type: 'phase_completed',
      nextPhase: '2',
      statusAfterCompletion: 'active',
      evidenceFiles: [
        'evidence/phase1_git_status.txt',
        'evidence/phase1_git_diff_stat.txt',
        'evidence/phase1_changed_files.txt',
      ],
      snapshotFiles: [
        'snapshots/phase1_before_complete.yaml',
        'snapshots/phase1_prompt.md',
      ],
      reviewFile: 'reviews/phase1_review.yaml',
    });
    expect(ledger.taskId).toBe(taskId);
    expect(ledger.events).toHaveLength(1);
    expect(ledger.events[0]).toMatchObject({
      id: '0001',
      type: 'phase_completed',
      markdownFile: 'completions/0001-1.md',
    });
    expect(ledger.events[0]?.rollbackSafePointId).toBe(result.completionEvent?.rollbackSafePointId);
    expect(completionFiles.filter((file) => file.endsWith('.md'))).toEqual(['0001-1.md']);

    const markdown = await readFile(
      path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'completions', '0001-1.md'),
      'utf-8'
    );
    expect(markdown).toContain('# Completion 0001: 1');
    expect(markdown).toContain(`- Task: ${taskId}`);
    expect(markdown).toContain('- Type: phase_completed');
    expect(markdown).toContain(`- .playspec/tasks/active/${taskId}/evidence/phase1_git_status.txt`);
    expect(markdown).toContain(`- .playspec/tasks/active/${taskId}/snapshots/phase1_before_complete.yaml`);
    expect(markdown).toContain(`- .playspec/tasks/active/${taskId}/reviews/phase1_review.yaml`);
    expect(markdown).toContain('- Rollback safe point: phase1_');
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

  it('preserves original and destination paths for renamed files in changed-files evidence', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    await writeTextFile(path.join(workspace.dir, 'src', 'old-name.ts'), 'export const renamed = true;\n');
    await execa('git', ['add', 'src/old-name.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'add tracked file for evidence rename'], { cwd: workspace.dir });
    await execa('git', ['mv', 'src/old-name.ts', 'src/new-name.ts'], { cwd: workspace.dir });

    const core = new PlaySpecCore(workspace.dir, store);
    await core.collectEvidence(taskId);

    const changedFiles = await readFile(
      path.join(
        workspace.dir,
        '.playspec',
        'tasks',
        'active',
        taskId,
        'evidence',
        'phase1_manual_changed_files.txt'
      ),
      'utf-8'
    );

    expect(changedFiles.split('\n')).toContain('src/old-name.ts -> src/new-name.ts');
    expect(changedFiles.split('\n')).not.toContain('src/new-name.ts');
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
    expect(result.completionEvent).toMatchObject({
      id: '0001',
      phase: '5',
      nextPhase: null,
      statusAfterCompletion: 'completed',
    });
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
      TSX_PATH,
      [
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
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'workflow.yaml'),
      `id: multi-spec
builtinShadow:
  accepted: true
mode: linear
variables:
  FEATURE_SLUG:
    required: true
  PHASE_SPEC_FILE:
    default: "docs/{{FEATURE_SLUG}}/{{FEATURE_SLUG}}_phase{{PHASE_NUMBER}}_implementation_spec.md"
  PHASE_HANDOFF_FILE:
    default: "docs/{{FEATURE_SLUG}}/{{FEATURE_SLUG}}_phase{{PHASE_NUMBER}}_handoff.md"
phaseOrder:
  - "1"
phases:
  "1":
    title: "Phase 1"
    template: phase_template.md
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
    await writeTextFile(
      path.join(workspace.dir, '.playspec', 'workflows', 'multi-spec', 'templates', 'phase_template.md'),
      '# {{TASK_TITLE}}\n'
    );

    const core = new PlaySpecCore(workspace.dir, store);
    await core.completePhase(taskId, { withReview: true });

    const task = await store.getTask(taskId);
    expect(task.phaseHistory).toContainEqual(
      expect.objectContaining({
        phase: '1',
        validationTemplate: 'workflow/multi-spec/templates/validation/checklist.md',
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
    expect(reviewContent).toContain('workflow/multi-spec/templates/validation/checklist.md');
  });

  it('reports medium desync for tracked source edits after completion', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    const core = new PlaySpecCore(workspace.dir, store);
    await core.completePhase(taskId);

    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 1;\n');
    await execa('git', ['add', 'src/app.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'add source'], { cwd: workspace.dir });
    await core.completePhase(taskId);
    await writeTextFile(path.join(workspace.dir, 'src', 'app.ts'), 'export const value = 2;\n');

    const result = await core.checkTaskDesync(taskId);

    expect(result.severity).toBe('medium');
    expect(result.changedFiles).toContain('src/app.ts');
  });

  it('reports high desync for deleted tracked files after completion', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    const trackedPath = path.join(workspace.dir, 'src', 'deleted.ts');
    await writeTextFile(trackedPath, 'export const deleted = true;\n');
    await execa('git', ['add', 'src/deleted.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'add tracked file'], { cwd: workspace.dir });

    const core = new PlaySpecCore(workspace.dir, store);
    await core.completePhase(taskId);
    await execa('git', ['rm', 'src/deleted.ts'], { cwd: workspace.dir });

    const result = await core.checkTaskDesync(taskId);

    expect(result.severity).toBe('high');
    expect(result.deletedFiles).toContain('src/deleted.ts');
  });

  it('reports high desync for renamed tracked files through PlaySpecCore', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    await writeTextFile(path.join(workspace.dir, 'src', 'old-name.ts'), 'export const renamed = true;\n');
    await execa('git', ['add', 'src/old-name.ts'], { cwd: workspace.dir });
    await execa('git', ['commit', '-m', 'add tracked file for rename'], { cwd: workspace.dir });

    const core = new PlaySpecCore(workspace.dir, store);
    await core.completePhase(taskId);
    await execa('git', ['mv', 'src/old-name.ts', 'src/new-name.ts'], { cwd: workspace.dir });

    const result = await core.checkTaskDesync(taskId);

    expect(result.severity).toBe('high');
    expect(result.renamedFiles).toEqual(['src/new-name.ts', 'src/old-name.ts']);
    expect(result.reasons).toContain('Tracked files were renamed since the last safe point.');
  });
});

describe('setCurrentPhase — phase-pointer recovery', () => {
  it('changes currentPhase and updatedAt without touching phaseHistory', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    const core = new PlaySpecCore(workspace.dir, store);

    // Advance to phase 2 so phaseHistory has an entry
    await core.completePhase(taskId);
    const afterComplete = await store.getTask(taskId);
    expect(afterComplete.currentPhase).toBe('2');
    const historyBefore = afterComplete.phaseHistory.map((e) => ({ ...e }));
    const updatedAtBefore = afterComplete.updatedAt;

    // Rewind to phase 1
    const result = await core.setCurrentPhase(taskId, '1');

    const afterRewind = await store.getTask(taskId);
    expect(result.taskId).toBe(taskId);
    expect(result.previousPhase).toBe('2');
    expect(result.currentPhase).toBe('1');
    expect(afterRewind.currentPhase).toBe('1');
    expect(afterRewind.updatedAt).not.toBe(updatedAtBefore);
    expect(afterRewind.phaseHistory).toEqual(historyBefore);
    expect(afterRewind.status).toBe('active');
  });

  it('rejects recovery on an inactive (completed) task', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    await store.updateTask(taskId, { status: 'completed' });

    const core = new PlaySpecCore(workspace.dir, store);
    await expect(core.setCurrentPhase(taskId, '1')).rejects.toThrow('is not active');
  });

  it('rejects a target phase not in workflow phaseOrder', async () => {
    const { store, taskId } = await initWorkspaceWithTask();
    await store.updateTask(taskId, { currentPhase: '2' });

    const core = new PlaySpecCore(workspace.dir, store);
    await expect(core.setCurrentPhase(taskId, 'nonexistent')).rejects.toThrow('Invalid phase: nonexistent');
  });

  it('preserves artifact directories after recovery', async () => {
    const { access: fsAccess } = await import('node:fs/promises');
    const { store, taskId } = await initWorkspaceWithTask();
    const core = new PlaySpecCore(workspace.dir, store);

    await core.completePhase(taskId);
    const taskRoot = path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId);

    // Confirm snapshot exists before recovery
    await expect(
      fsAccess(path.join(taskRoot, 'snapshots', 'phase1_before_complete.yaml'))
    ).resolves.not.toThrow();

    // Recover: rewind to phase 1
    await core.setCurrentPhase(taskId, '1');

    // Snapshot must still be there
    await expect(
      fsAccess(path.join(taskRoot, 'snapshots', 'phase1_before_complete.yaml'))
    ).resolves.not.toThrow();

    // Evidence must still be there
    await expect(
      fsAccess(path.join(taskRoot, 'evidence', 'phase1_git_status.txt'))
    ).resolves.not.toThrow();
  });
});
