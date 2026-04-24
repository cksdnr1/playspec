import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { createTempWorkspace, type TempWorkspace } from './createTempWorkspace.js';

const REPO_ROOT = path.resolve('/volume2/PJ/playspec');

describe('createTempWorkspace', () => {
  let workspace: TempWorkspace | null = null;

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
      workspace = null;
    }
  });

  it('creates a workspace directory outside repo root', async () => {
    workspace = await createTempWorkspace();
    expect(workspace.dir).toBeTruthy();
    expect(workspace.dir.startsWith(REPO_ROOT)).toBe(false);
  });

  it('cleans up the workspace after use', async () => {
    workspace = await createTempWorkspace();
    const dir = workspace.dir;
    await workspace.cleanup();
    workspace = null;

    const { access } = await import('node:fs/promises');
    await expect(access(dir)).rejects.toThrow();
  });
});
