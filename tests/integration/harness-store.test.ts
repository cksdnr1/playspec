import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';
import { PresetManager } from '#preset/preset-manager.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { HarnessBlockedError } from '#core/errors.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';
import { getActiveTaskRoot, getHarnessRecordPath } from '#utils/paths.js';
import type { HarnessRecord } from '#core/types.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function initWorkspaceWithTask(taskId = 'harness_task') {
  const manager = new PresetManager();
  await manager.initWorkspace(workspace.dir, 'default');

  const store = new YamlTaskStore(workspace.dir);
  await store.createTask({
    id: taskId,
    title: 'Harness Task',
    workflow: 'multi-spec',
  });
  return { store, core: new PlaySpecCore(workspace.dir, store), taskId };
}

describe('automation safety harness store', () => {
  it('returns default status without creating harness.yaml', async () => {
    const { core, taskId } = await initWorkspaceWithTask();

    const record = await core.getHarnessStatus(taskId);

    expect(record).toEqual(expect.objectContaining({
      taskId,
      phaseId: '1',
      attemptCount: 0,
      retryBudget: 3,
      lastResult: null,
      lastFailureReason: null,
      blocked: false,
      circuitBreaker: false,
      resetEvents: [],
    }));
    await expect(access(getHarnessRecordPath(workspace.dir, taskId))).rejects.toThrow();
  });

  it('increments failures and blocks at the retry budget', async () => {
    const { core, taskId } = await initWorkspaceWithTask();

    await core.recordHarnessAttempt(taskId, '1', 'failure', 'first');
    await core.recordHarnessAttempt(taskId, '1', 'failure', 'second');
    const blocked = await core.recordHarnessAttempt(taskId, '1', 'failure', 'third');

    expect(blocked.attemptCount).toBe(3);
    expect(blocked.retryBudget).toBe(3);
    expect(blocked.lastResult).toBe('failure');
    expect(blocked.lastFailureReason).toBe('third');
    expect(blocked.blocked).toBe(true);
    expect(blocked.circuitBreaker).toBe(true);

    const stored = parseYaml(await readTextFile(getHarnessRecordPath(workspace.dir, taskId))) as HarnessRecord;
    expect(stored.blocked).toBe(true);
    expect(stored.circuitBreaker).toBe(true);
  });

  it('rejects additional attempts while the circuit breaker is active', async () => {
    const { core, taskId } = await initWorkspaceWithTask();

    await core.recordHarnessAttempt(taskId, '1', 'failure');
    await core.recordHarnessAttempt(taskId, '1', 'failure');
    await core.recordHarnessAttempt(taskId, '1', 'failure');

    await expect(
      core.recordHarnessAttempt(taskId, '1', 'failure', 'fourth')
    ).rejects.toThrow(HarnessBlockedError);
  });

  it('success clears transient failure state before the circuit breaker trips', async () => {
    const { core, taskId } = await initWorkspaceWithTask();

    await core.recordHarnessAttempt(taskId, '1', 'failure', 'temporary');
    const success = await core.recordHarnessAttempt(taskId, '1', 'success');

    expect(success.attemptCount).toBe(1);
    expect(success.lastResult).toBe('success');
    expect(success.lastFailureReason).toBeNull();
    expect(success.blocked).toBe(false);
    expect(success.circuitBreaker).toBe(false);
  });

  it('reset persists prior blocked state and preserves evidence files', async () => {
    const { core, taskId } = await initWorkspaceWithTask();
    const evidencePath = path.join(getActiveTaskRoot(workspace.dir, taskId), 'evidence', 'manual.txt');
    await writeFile(evidencePath, 'kept', 'utf-8');

    await core.recordHarnessAttempt(taskId, '1', 'failure');
    await core.recordHarnessAttempt(taskId, '1', 'failure');
    await core.recordHarnessAttempt(taskId, '1', 'failure');
    const reset = await core.resetHarness(taskId, 'human reviewed');

    expect(reset.blocked).toBe(false);
    expect(reset.circuitBreaker).toBe(false);
    expect(reset.resetEvents).toHaveLength(1);
    expect(reset.resetEvents[0]).toEqual(expect.objectContaining({
      taskId,
      previousBlocked: true,
      previousCircuitBreaker: true,
      reason: 'human reviewed',
      source: 'cli',
    }));
    await expect(access(evidencePath)).resolves.not.toThrow();

    const taskYaml = await readTextFile(path.join(getActiveTaskRoot(workspace.dir, taskId), 'task.yaml'));
    expect(taskYaml).not.toContain('attemptCount');
    expect(taskYaml).not.toContain('circuitBreaker');
  });

  it('validates persisted harness records before use', async () => {
    const { core, taskId } = await initWorkspaceWithTask();
    await writeTextFile(getHarnessRecordPath(workspace.dir, taskId), 'attemptCount: nope\n');

    await expect(core.getHarnessStatus(taskId)).rejects.toThrow();
  });
});
