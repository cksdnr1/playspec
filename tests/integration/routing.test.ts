import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import {
  MissingResultError,
  InvalidResultError,
  MissingResultMappingError,
  InvalidRoutingTargetError,
  LoopGuardError,
  UnexpectedResultError,
  PhaseAdvancedError,
  MissingRequiredVariablesError,
} from '#core/errors.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../../tsconfig.json');
const TSX_PATH = path.resolve(TESTS_DIR, '../../node_modules/.bin/tsx');

let workspace: TempWorkspace;
let previousUserWorkflows: string | undefined;

vi.setConfig({ testTimeout: 15_000 });

// Routed workflow with validation -> implementation | spec_patch
const ROUTED_WORKFLOW_YAML = `id: routed-spec
mode: linear
phaseOrder:
  - validation
  - implementation
  - spec_patch
phases:
  validation:
    title: Spec Validation
    template: phase_template.md
    results:
      - approved
      - needs_patch
    nextByResult:
      approved: implementation
      needs_patch: spec_patch
    eventTypes:
      approved: approved
      needs_patch: needs_revision
    maxVisits: 2
  implementation:
    title: Implementation
    template: phase_template.md
  spec_patch:
    title: Spec Patch
    template: phase_template.md
    next: validation
`;

const SIMPLE_TEMPLATE = `# {{TASK_TITLE}} — {{PHASE_NUMBER}}
`;

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

async function initRoutedWorkspace(taskId = 'routed_task') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  // Write routed workflow as an isolated user workflow.
  await writeTextFile(
    path.join(process.env['PLAY_SPEC_USER_WORKFLOWS']!, 'routed-spec', 'workflow.yaml'),
    ROUTED_WORKFLOW_YAML
  );
  await writeTextFile(
    path.join(process.env['PLAY_SPEC_USER_WORKFLOWS']!, 'routed-spec', 'templates', 'phase_template.md'),
    SIMPLE_TEMPLATE
  );

  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title: 'Routed Task',
    workflow: 'routed-spec',
  });

  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

  await execa('git', ['init'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.email', 'playspec@example.com'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.name', 'PlaySpec Test'], { cwd: workspace.dir });
  await execa('git', ['add', '.'], { cwd: workspace.dir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: workspace.dir });

  return { store, taskId };
}

async function initMonoSpecWorkspace(taskId = 'mono_task') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title: 'Migration Bug Fix',
    workflow: 'mono-spec',
  });

  await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

  await execa('git', ['init'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.email', 'playspec@example.com'], { cwd: workspace.dir });
  await execa('git', ['config', 'user.name', 'PlaySpec Test'], { cwd: workspace.dir });
  await execa('git', ['add', '.'], { cwd: workspace.dir });
  await execa('git', ['commit', '-m', 'initial'], { cwd: workspace.dir });

  return { store, taskId };
}

describe('Phase 3.7 — Simple Conditional Routing', () => {
  describe('Workflow schema accepts routing fields', () => {
    it('loads a workflow with results, nextByResult, and maxVisits', async () => {
      await initRoutedWorkspace();
      const { WorkflowLoader } = await import('#workflow/workflow-loader.js');
      const loader = new WorkflowLoader(workspace.dir);
      const workflow = await loader.load('routed-spec');

      expect(workflow.phases['validation']?.results).toEqual(['approved', 'needs_patch']);
      expect(workflow.phases['validation']?.nextByResult).toEqual({
        approved: 'implementation',
        needs_patch: 'spec_patch',
      });
      expect(workflow.phases['validation']?.eventTypes).toEqual({
        approved: 'approved',
        needs_patch: 'needs_revision',
      });
      expect(workflow.phases['validation']?.maxVisits).toBe(2);
    });
  });

  describe('Linear workflow still advances without result', () => {
    it('completes a non-routed phase linearly when no result provided', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      // Put the task on the non-routed "implementation" phase
      await store.updateTask(taskId, { currentPhase: 'implementation' });

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, {});

      expect(result.completedPhase).toBe('implementation');
      expect(result.nextPhase).toBe('spec_patch');

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('spec_patch');
      const historyEntry = task.phaseHistory.find((e) => e.phase === 'implementation');
      expect(historyEntry?.result).toBeUndefined();
      expect(historyEntry?.visitCount).toBeUndefined();
    });
  });

  describe('Explicit routed completion via Core', () => {
    it('routes to implementation when result is approved', async () => {
      const { store, taskId } = await initRoutedWorkspace();

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, { result: 'approved' });

      expect(result.completedPhase).toBe('validation');
      expect(result.nextPhase).toBe('implementation');

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation');
      const historyEntry = task.phaseHistory.find((e) => e.phase === 'validation');
      expect(historyEntry?.result).toBe('approved');
      expect(historyEntry?.visitCount).toBe(1);
      expect(result.completionEvent).toMatchObject({
        id: '0001',
        phase: 'validation',
        type: 'approved',
        result: 'approved',
      });
    });

    it('routes to spec_patch when result is needs_patch', async () => {
      const { store, taskId } = await initRoutedWorkspace();

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, { result: 'needs_patch' });

      expect(result.completedPhase).toBe('validation');
      expect(result.nextPhase).toBe('spec_patch');

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('spec_patch');
      expect(result.completionEvent).toMatchObject({
        id: '0001',
        phase: 'validation',
        type: 'needs_revision',
        result: 'needs_patch',
      });
    });

    it('records ordered completion events through a revision loop', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      const core = new PlaySpecCore(workspace.dir, store);

      await core.completePhase(taskId, { result: 'needs_patch' });
      await core.completePhase(taskId);
      await core.completePhase(taskId, { result: 'approved' });

      const ledger = parseYaml(await readFile(
        path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId, 'completions', 'index.yaml'),
        'utf-8'
      )) as { events: Array<{ id: string; phase: string; type: string; result?: string; markdownFile: string }> };

      expect(ledger.events).toMatchObject([
        {
          id: '0001',
          phase: 'validation',
          type: 'needs_revision',
          result: 'needs_patch',
          markdownFile: 'completions/0001-validation-needs_revision.md',
        },
        {
          id: '0002',
          phase: 'spec_patch',
          type: 'patch_completed',
          markdownFile: 'completions/0002-spec_patch.md',
        },
        {
          id: '0003',
          phase: 'validation',
          type: 'approved',
          result: 'approved',
          markdownFile: 'completions/0003-validation-approved.md',
        },
      ]);
    });
  });

  describe('Error cases — before any state mutation', () => {
    it('throws MissingResultError when result-bearing phase has no result', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      const core = new PlaySpecCore(workspace.dir, store);

      await expect(core.completePhase(taskId, {})).rejects.toThrow(MissingResultError);

      // Task state must be unchanged
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBeNull();
      expect(task.phaseHistory).toHaveLength(0);
    });

    it('throws InvalidResultError for unknown result value', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      const core = new PlaySpecCore(workspace.dir, store);

      await expect(core.completePhase(taskId, { result: 'maybe' })).rejects.toThrow(InvalidResultError);

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBeNull();
      expect(task.phaseHistory).toHaveLength(0);
    });

    it('throws UnexpectedResultError when result provided for non-routed phase', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      await store.updateTask(taskId, { currentPhase: 'implementation' });

      const core = new PlaySpecCore(workspace.dir, store);
      await expect(core.completePhase(taskId, { result: 'approved' })).rejects.toThrow(UnexpectedResultError);

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation');
      expect(task.phaseHistory).toHaveLength(0);
    });

    it('throws InvalidRoutingTargetError when nextByResult maps to non-existent phase', async () => {
      await initRoutedWorkspace();
      // Write a workflow with a bad mapping
      await writeTextFile(
        path.join(process.env['PLAY_SPEC_USER_WORKFLOWS']!, 'routed-spec', 'workflow.yaml'),
        `id: routed-spec
mode: linear
phaseOrder:
  - validation
  - implementation
phases:
  validation:
    title: Spec Validation
    template: phase_template.md
    results:
      - approved
    nextByResult:
      approved: nonexistent_phase
  implementation:
    title: Implementation
    template: phase_template.md
`
      );

      const store = new YamlTaskStore(workspace.dir);
      const taskId = 'bad_routing_task';
      await store.createTask({ id: taskId, title: 'Bad Routing', workflow: 'routed-spec' });
      await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

      const core = new PlaySpecCore(workspace.dir, store);
      await expect(core.completePhase(taskId, { result: 'approved' })).rejects.toThrow(InvalidRoutingTargetError);
    });

    it('throws before mutation when routed next phase is missing required variables', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      await writeTextFile(
        path.join(process.env['PLAY_SPEC_USER_WORKFLOWS']!, 'routed-spec', 'workflow.yaml'),
        `id: routed-spec
mode: linear
phaseOrder:
  - validation
  - implementation
phases:
  validation:
    title: Spec Validation
    template: phase_template.md
    results:
      - approved
    nextByResult:
      approved: implementation
  implementation:
    title: Implementation
    template: phase_template.md
    requiredVariables:
      - CUSTOM_REQUIRED
`
      );

      const taskRoot = path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId);
      const taskBefore = await store.getTask(taskId);
      const core = new PlaySpecCore(workspace.dir, store);

      await expect(core.completePhase(taskId, { result: 'approved' })).rejects.toThrow(
        MissingRequiredVariablesError
      );

      const taskAfter = await store.getTask(taskId);
      expect(taskAfter.currentPhase).toBe(taskBefore.currentPhase);
      expect(taskAfter.phaseHistory).toEqual(taskBefore.phaseHistory);
      expect(taskAfter.stateSync).toEqual(taskBefore.stateSync);
      expect(taskAfter.rollback).toEqual(taskBefore.rollback);
      expect(await readdir(path.join(taskRoot, 'snapshots'))).toEqual([]);
      expect(await readdir(path.join(taskRoot, 'evidence'))).toEqual([]);
      await expect(access(path.join(taskRoot, 'completions', 'index.yaml'))).rejects.toThrow();
    });
  });

  describe('Visit counting and maxVisits loop guard', () => {
    it('appends repeated completed entries with incrementing visitCount', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      const core = new PlaySpecCore(workspace.dir, store);
      const taskRoot = path.join(workspace.dir, '.playspec', 'tasks', 'active', taskId);

      // First visit: validation -> spec_patch
      const firstResult = await core.completePhase(taskId, { result: 'needs_patch', withReview: true });
      const firstVisitTask = await store.getTask(taskId);
      const firstValidationEntry = firstVisitTask.phaseHistory.find((e) => e.phase === 'validation');
      const firstVisitFiles = [
        ...(firstValidationEntry?.snapshotFiles ?? []),
        ...(firstValidationEntry?.evidenceFiles ?? []),
      ];
      const firstVisitContents = await Promise.all(
        firstVisitFiles.map(async (file) => readFile(path.join(taskRoot, file), 'utf-8'))
      );
      expect(firstResult.reviewFile).toBe('reviews/phasevalidation_review.yaml');
      expect(firstValidationEntry?.reviewFile).toBe('reviews/phasevalidation_review.yaml');
      const firstReviewContents = await readFile(
        path.join(taskRoot, firstResult.reviewFile),
        'utf-8'
      );

      // Move back to validation manually (simulating routing loop)
      await store.updateTask(taskId, { currentPhase: 'validation' });

      // Second visit: validation -> implementation
      const secondResult = await core.completePhase(taskId, { result: 'approved', withReview: true });

      const task = await store.getTask(taskId);
      const validationEntries = task.phaseHistory.filter((e) => e.phase === 'validation');
      expect(validationEntries).toHaveLength(2);
      expect(validationEntries[0]?.visitCount).toBe(1);
      expect(validationEntries[0]?.result).toBe('needs_patch');
      expect(validationEntries[1]?.visitCount).toBe(2);
      expect(validationEntries[1]?.result).toBe('approved');
      expect(validationEntries[0]?.snapshotFiles).toEqual([
        'snapshots/phasevalidation_before_complete.yaml',
        'snapshots/phasevalidation_prompt.md',
      ]);
      expect(validationEntries[1]?.snapshotFiles).toEqual([
        'snapshots/phasevalidation_visit2_before_complete.yaml',
        'snapshots/phasevalidation_visit2_prompt.md',
      ]);
      expect(validationEntries[0]?.evidenceFiles).toEqual([
        'evidence/phasevalidation_git_status.txt',
        'evidence/phasevalidation_git_diff_stat.txt',
        'evidence/phasevalidation_changed_files.txt',
      ]);
      expect(validationEntries[1]?.evidenceFiles).toEqual([
        'evidence/phasevalidation_visit2_git_status.txt',
        'evidence/phasevalidation_visit2_git_diff_stat.txt',
        'evidence/phasevalidation_visit2_changed_files.txt',
      ]);
      expect(secondResult.reviewFile).toBe('reviews/phasevalidation_visit2_review.yaml');
      expect(validationEntries[0]?.reviewFile).toBe('reviews/phasevalidation_review.yaml');
      expect(validationEntries[1]?.reviewFile).toBe('reviews/phasevalidation_visit2_review.yaml');
      expect(validationEntries[0]?.reviewFile).not.toBe(validationEntries[1]?.reviewFile);
      expect(validationEntries[0]?.snapshotFiles).not.toEqual(validationEntries[1]?.snapshotFiles);
      expect(validationEntries[0]?.evidenceFiles).not.toEqual(validationEntries[1]?.evidenceFiles);
      expect(task.rollback?.lastSafePoint).toMatchObject({
        phase: 'validation',
        taskSnapshotFile: 'snapshots/phasevalidation_visit2_before_complete.yaml',
        promptSnapshotFile: 'snapshots/phasevalidation_visit2_prompt.md',
      });

      const allVisitFiles = validationEntries.flatMap((entry) => [
        ...(entry.snapshotFiles ?? []),
        ...(entry.evidenceFiles ?? []),
      ]);
      await Promise.all(
        allVisitFiles.map(async (file) => expect(access(path.join(taskRoot, file))).resolves.not.toThrow())
      );
      await expect(access(path.join(taskRoot, 'reviews', 'phasevalidation_review.yaml'))).resolves.not.toThrow();
      await expect(access(path.join(taskRoot, 'reviews', 'phasevalidation_visit2_review.yaml'))).resolves.not.toThrow();
      await expect(
        readFile(path.join(taskRoot, 'reviews', 'phasevalidation_review.yaml'), 'utf-8')
      ).resolves.toBe(firstReviewContents);
      await expect(
        Promise.all(firstVisitFiles.map(async (file) => readFile(path.join(taskRoot, file), 'utf-8')))
      ).resolves.toEqual(firstVisitContents);

      const ledger = parseYaml(await readFile(
        path.join(taskRoot, 'completions', 'index.yaml'),
        'utf-8'
      )) as { events: Array<{ id: string; markdownFile: string; reviewFile?: string }> };
      expect(ledger.events).toMatchObject([
        {
          id: '0001',
          markdownFile: 'completions/0001-validation-needs_revision.md',
          reviewFile: 'reviews/phasevalidation_review.yaml',
        },
        {
          id: '0002',
          markdownFile: 'completions/0002-validation-approved.md',
          reviewFile: 'reviews/phasevalidation_visit2_review.yaml',
        },
      ]);

      const firstCompletionMarkdown = await readFile(
        path.join(taskRoot, 'completions', '0001-validation-needs_revision.md'),
        'utf-8'
      );
      const secondCompletionMarkdown = await readFile(
        path.join(taskRoot, 'completions', '0002-validation-approved.md'),
        'utf-8'
      );
      expect(firstCompletionMarkdown).toContain(
        `.playspec/tasks/active/${taskId}/reviews/phasevalidation_review.yaml`
      );
      expect(secondCompletionMarkdown).toContain(
        `.playspec/tasks/active/${taskId}/reviews/phasevalidation_visit2_review.yaml`
      );
    });

    it('throws LoopGuardError when maxVisits is exceeded', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      const core = new PlaySpecCore(workspace.dir, store);

      // First visit (maxVisits=2, so 2 visits allowed)
      await core.completePhase(taskId, { result: 'needs_patch' });
      await store.updateTask(taskId, { currentPhase: 'validation' });

      // Second visit
      await core.completePhase(taskId, { result: 'needs_patch' });
      await store.updateTask(taskId, { currentPhase: 'validation' });

      // Third visit — should be blocked by loop guard
      const taskBefore = await store.getTask(taskId);
      await expect(core.completePhase(taskId, { result: 'needs_patch' })).rejects.toThrow(LoopGuardError);

      // State must be unchanged after guard fires
      const taskAfter = await store.getTask(taskId);
      expect(taskAfter.currentPhase).toBe('validation');
      expect(taskAfter.phaseHistory.filter((e) => e.phase === 'validation')).toHaveLength(
        taskBefore.phaseHistory.filter((e) => e.phase === 'validation').length
      );
    });
  });

  describe('End-to-end: playspec next follows routed phase', () => {
    it('renders the routed next phase after completing with a result', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      const core = new PlaySpecCore(workspace.dir, store);

      await core.completePhase(taskId, { result: 'approved' });

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation');

      const prompt = await core.renderNextPrompt(taskId);
      // Template uses {{PHASE_NUMBER}} which equals the phaseId string "implementation"
      expect(prompt).toContain('implementation');
    });
  });

  describe('CLI --result integration', () => {
    it('accepts --result and exits 0 for a routed phase', async () => {
      await initRoutedWorkspace();

      const { stdout, stderr, exitCode } = await execa(
        TSX_PATH,
        ['--tsconfig', TSCONFIG_PATH, CLI_PATH, 'complete', '--result', 'approved'],
        { cwd: workspace.dir, reject: false }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Next phase: implementation');
    });

    it('exits 1 with an error when an invalid --result is provided', async () => {
      await initRoutedWorkspace();

      const { stderr, exitCode } = await execa(
        TSX_PATH,
        ['--tsconfig', TSCONFIG_PATH, CLI_PATH, 'complete', '--result', 'invalid_value'],
        { cwd: workspace.dir, reject: false }
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid result');
      expect(stderr).toContain('approved');
      expect(stderr).toContain('needs_patch');
    });

    it('exits 1 without --result in non-interactive mode for a routed phase', async () => {
      await initRoutedWorkspace();

      const { stderr, exitCode } = await execa(
        TSX_PATH,
        ['--tsconfig', TSCONFIG_PATH, CLI_PATH, 'complete'],
        { cwd: workspace.dir, reject: false, stdin: 'pipe' }
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain('approved');
      expect(stderr).toContain('needs_patch');
    });
  });

  describe('Default mono-spec gate routing', () => {
    it('routes technical spec validate approved to implementation plan creation, skipping patch', async () => {
      const { store, taskId } = await initMonoSpecWorkspace();
      await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, { result: 'approved' });

      expect(result.nextPhase).toBe('implementation_plan_create');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation_plan_create');
      expect(task.currentPhase).not.toBe('tech_spec_patch');
    });

    it('routes technical spec validate needs_revision to tech_spec_patch', async () => {
      const { store, taskId } = await initMonoSpecWorkspace();
      await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, { result: 'needs_revision' });

      expect(result.nextPhase).toBe('tech_spec_patch');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('tech_spec_patch');
    });

    it('routes tech_spec_patch (non-gated) back to tech_spec_validate via explicit next', async () => {
      const { store, taskId } = await initMonoSpecWorkspace();
      await store.updateTask(taskId, { currentPhase: 'tech_spec_patch' });

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, {});

      expect(result.nextPhase).toBe('tech_spec_validate');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('tech_spec_validate');
    });

    it('routes implementation plan validate approved to implementation, skipping patch', async () => {
      const { store, taskId } = await initMonoSpecWorkspace();
      await store.updateTask(taskId, { currentPhase: 'implementation_plan_validate' });

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, { result: 'approved' });

      expect(result.nextPhase).toBe('implementation');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation');
    });

    it('routes implementation plan validate needs_revision to implementation_plan_patch', async () => {
      const { store, taskId } = await initMonoSpecWorkspace();
      await store.updateTask(taskId, { currentPhase: 'implementation_plan_validate' });

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, { result: 'needs_revision' });

      expect(result.nextPhase).toBe('implementation_plan_patch');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation_plan_patch');
    });

    it('routes implementation_plan_patch (non-gated) back to implementation_plan_validate via explicit next', async () => {
      const { store, taskId } = await initMonoSpecWorkspace();
      await store.updateTask(taskId, { currentPhase: 'implementation_plan_patch' });

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, {});

      expect(result.nextPhase).toBe('implementation_plan_validate');
      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('implementation_plan_validate');
    });

    it('does not silently advance tech_spec_validate without a result', async () => {
      const { store, taskId } = await initMonoSpecWorkspace();
      await store.updateTask(taskId, { currentPhase: 'tech_spec_validate' });

      const core = new PlaySpecCore(workspace.dir, store);
      await expect(core.completePhase(taskId, {})).rejects.toThrow(MissingResultError);

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('tech_spec_validate');
      expect(task.phaseHistory).toHaveLength(0);
    });

    it('rejects --result on non-gated tech_spec_patch with UnexpectedResultError', async () => {
      const { store, taskId } = await initMonoSpecWorkspace();
      await store.updateTask(taskId, { currentPhase: 'tech_spec_patch' });

      const core = new PlaySpecCore(workspace.dir, store);
      await expect(core.completePhase(taskId, { result: 'approved' })).rejects.toThrow(UnexpectedResultError);

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('tech_spec_patch');
      expect(task.phaseHistory).toHaveLength(0);
    });
  });

  describe('MissingResultMappingError', () => {
    it('throws when nextByResult does not include the given result', async () => {
      // Write a workflow with results but only partial nextByResult mapping
      await writeTextFile(
        path.join(process.env['PLAY_SPEC_USER_WORKFLOWS']!, 'partial-routing', 'workflow.yaml'),
        `id: partial-routing
mode: linear
phaseOrder:
  - validation
  - implementation
phases:
  validation:
    title: Validation
    template: phase_template.md
    results:
      - approved
      - needs_patch
    nextByResult:
      approved: implementation
  implementation:
    title: Implementation
    template: phase_template.md
`
      );
      await writeTextFile(
        path.join(process.env['PLAY_SPEC_USER_WORKFLOWS']!, 'partial-routing', 'templates', 'phase_template.md'),
        SIMPLE_TEMPLATE
      );

      await initRoutedWorkspace();
      const store = new YamlTaskStore(workspace.dir);
      const taskId = 'partial_routing_task';
      await store.createTask({ id: taskId, title: 'Partial Routing', workflow: 'partial-routing' });
      await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

      const core = new PlaySpecCore(workspace.dir, store);
      await expect(core.completePhase(taskId, { result: 'needs_patch' })).rejects.toThrow(MissingResultMappingError);

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBeNull();
      expect(task.phaseHistory).toHaveLength(0);
    });
  });
});

describe('completePhase expectedPhaseId guard', () => {
  it('completes when expectedPhaseId matches the current phase', async () => {
    const { store, taskId } = await initRoutedWorkspace();
    const core = new PlaySpecCore(workspace.dir, store);

    const result = await core.completePhase(taskId, { result: 'approved', expectedPhaseId: 'validation' });
    expect(result.nextPhase).toBe('implementation');

    const task = await store.getTask(taskId);
    expect(task.currentPhase).toBe('implementation');
  });

  it('rejects with PhaseAdvancedError when expectedPhaseId does not match, before any mutation', async () => {
    const { store, taskId } = await initRoutedWorkspace();
    const core = new PlaySpecCore(workspace.dir, store);

    await expect(
      core.completePhase(taskId, { result: 'approved', expectedPhaseId: 'spec_patch' })
    ).rejects.toThrow(PhaseAdvancedError);

    // No mutation: the task is untouched (still on the unresolved initial phase).
    const task = await store.getTask(taskId);
    expect(task.phaseHistory).toHaveLength(0);
    // The resolved effective phase is still the first phase.
    const status = await core.getTaskStatus(taskId);
    expect(status.currentPhase).toBe('validation');
  });

  it('completes normally when expectedPhaseId is omitted', async () => {
    const { store, taskId } = await initRoutedWorkspace();
    const core = new PlaySpecCore(workspace.dir, store);

    const result = await core.completePhase(taskId, { result: 'approved' });
    expect(result.nextPhase).toBe('implementation');
  });
});

describe('getTaskStatus lightweight projection', () => {
  it('returns minimal active-task status', async () => {
    const { store, taskId } = await initRoutedWorkspace();
    const core = new PlaySpecCore(workspace.dir, store);

    const status = await core.getTaskStatus(taskId);
    expect(status).toMatchObject({
      id: taskId,
      title: 'Routed Task',
      workflow: 'routed-spec',
      status: 'active',
      currentPhase: 'validation',
      isWorkflowComplete: false,
      lastCompletedAt: null,
    });
    // Must not leak the heavy fields the full record carries.
    expect(status).not.toHaveProperty('phaseHistory');
    expect(status).not.toHaveProperty('contextRefs');
  });

  it('reflects phase advance and records lastCompletedAt after completion', async () => {
    const { store, taskId } = await initRoutedWorkspace();
    const core = new PlaySpecCore(workspace.dir, store);

    await core.completePhase(taskId, { result: 'approved' });

    const status = await core.getTaskStatus(taskId);
    expect(status.currentPhase).toBe('implementation');
    expect(status.lastCompletedAt).not.toBeNull();
  });
});
