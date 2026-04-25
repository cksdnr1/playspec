import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

export interface TempWorkspace {
  dir: string;
  cleanup: () => Promise<void>;
}

export async function createTempWorkspace(): Promise<TempWorkspace> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'playspec-test-'));

  // Safety assertion: temp dir must be outside repo root
  if (dir.startsWith(REPO_ROOT)) {
    throw new Error(
      `SAFETY VIOLATION: temp workspace created inside repo root: ${dir}`
    );
  }

  return {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
