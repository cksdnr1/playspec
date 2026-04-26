import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
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
} from '#core/errors.js';
import { writeTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(TESTS_DIR, '../../src/cli/index.ts');
const TSCONFIG_PATH = path.resolve(TESTS_DIR, '../../tsconfig.json');

let workspace: TempWorkspace;

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
    template: routed-spec/phase_template.md
    results:
      - approved
      - needs_patch
    nextByResult:
      approved: implementation
      needs_patch: spec_patch
    maxVisits: 2
  implementation:
    title: Implementation
    template: routed-spec/phase_template.md
  spec_patch:
    title: Spec Patch
    template: routed-spec/phase_template.md
`;

const SIMPLE_TEMPLATE = `# {{TASK_TITLE}} — {{PHASE_NUMBER}}
`;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function initRoutedWorkspace(taskId = 'routed_task') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  // Write routed workflow
  await writeTextFile(
    path.join(workspace.dir, '.playspec', 'workflows', 'routed-spec.yaml'),
    ROUTED_WORKFLOW_YAML
  );
  // Write minimal template
  await writeTextFile(
    path.join(workspace.dir, '.playspec', 'templates', 'routed-spec', 'phase_template.md'),
    SIMPLE_TEMPLATE
  );

  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title: 'Routed Task',
    workflowType: 'routed-spec',
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
    workflowType: 'mono-spec',
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
    });

    it('routes to spec_patch when result is needs_patch', async () => {
      const { store, taskId } = await initRoutedWorkspace();

      const core = new PlaySpecCore(workspace.dir, store);
      const result = await core.completePhase(taskId, { result: 'needs_patch' });

      expect(result.completedPhase).toBe('validation');
      expect(result.nextPhase).toBe('spec_patch');

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBe('spec_patch');
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
        path.join(workspace.dir, '.playspec', 'workflows', 'routed-spec.yaml'),
        `id: routed-spec
mode: linear
phaseOrder:
  - validation
  - implementation
phases:
  validation:
    title: Spec Validation
    template: routed-spec/phase_template.md
    results:
      - approved
    nextByResult:
      approved: nonexistent_phase
  implementation:
    title: Implementation
    template: routed-spec/phase_template.md
`
      );

      const store = new YamlTaskStore(workspace.dir);
      const taskId = 'bad_routing_task';
      await store.createTask({ id: taskId, title: 'Bad Routing', workflowType: 'routed-spec' });
      await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

      const core = new PlaySpecCore(workspace.dir, store);
      await expect(core.completePhase(taskId, { result: 'approved' })).rejects.toThrow(InvalidRoutingTargetError);
    });
  });

  describe('Visit counting and maxVisits loop guard', () => {
    it('appends repeated completed entries with incrementing visitCount', async () => {
      const { store, taskId } = await initRoutedWorkspace();
      const core = new PlaySpecCore(workspace.dir, store);

      // First visit: validation -> spec_patch
      await core.completePhase(taskId, { result: 'needs_patch' });
      // Move back to validation manually (simulating routing loop)
      await store.updateTask(taskId, { currentPhase: 'validation' });

      // Second visit: validation -> implementation
      await core.completePhase(taskId, { result: 'approved' });

      const task = await store.getTask(taskId);
      const validationEntries = task.phaseHistory.filter((e) => e.phase === 'validation');
      expect(validationEntries).toHaveLength(2);
      expect(validationEntries[0]?.visitCount).toBe(1);
      expect(validationEntries[0]?.result).toBe('needs_patch');
      expect(validationEntries[1]?.visitCount).toBe(2);
      expect(validationEntries[1]?.result).toBe('approved');
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
        'npx',
        ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, 'complete', '--result', 'approved'],
        { cwd: workspace.dir, reject: false }
      );

      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      expect(stdout).toContain('Next phase: implementation');
    });

    it('exits 1 with an error when an invalid --result is provided', async () => {
      await initRoutedWorkspace();

      const { stderr, exitCode } = await execa(
        'npx',
        ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, 'complete', '--result', 'invalid_value'],
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
        'npx',
        ['tsx', '--tsconfig', TSCONFIG_PATH, CLI_PATH, 'complete'],
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
        path.join(workspace.dir, '.playspec', 'workflows', 'partial-routing.yaml'),
        `id: partial-routing
mode: linear
phaseOrder:
  - validation
  - implementation
phases:
  validation:
    title: Validation
    template: routed-spec/phase_template.md
    results:
      - approved
      - needs_patch
    nextByResult:
      approved: implementation
  implementation:
    title: Implementation
    template: routed-spec/phase_template.md
`
      );

      await initRoutedWorkspace();
      const store = new YamlTaskStore(workspace.dir);
      const taskId = 'partial_routing_task';
      await store.createTask({ id: taskId, title: 'Partial Routing', workflowType: 'partial-routing' });
      await writeTextFile(getHeadPath(workspace.dir), `${taskId}\n`);

      const core = new PlaySpecCore(workspace.dir, store);
      await expect(core.completePhase(taskId, { result: 'needs_patch' })).rejects.toThrow(MissingResultMappingError);

      const task = await store.getTask(taskId);
      expect(task.currentPhase).toBeNull();
      expect(task.phaseHistory).toHaveLength(0);
    });
  });
});
