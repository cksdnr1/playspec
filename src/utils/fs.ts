import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { LockTimeoutError } from '#core/errors.js';

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

export async function writeTextFileAtomic(
  filePath: string,
  content: string | Uint8Array
): Promise<void> {
  const dirPath = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const tempPath = path.join(
    dirPath,
    `.${fileName}.${process.pid}.${Date.now()}.tmp`
  );

  await mkdir(dirPath, { recursive: true });
  await writeFile(tempPath, content, 'utf-8');

  try {
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

export async function withWriteLock<T>(
  lockTarget: string,
  fn: () => Promise<T>,
  options: {
    timeoutMs?: number;
    retryIntervalMs?: number;
  } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 1500;
  const retryIntervalMs = options.retryIntervalMs ?? 100;

  await mkdir(lockTarget, { recursive: true });

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(lockTarget, {
      realpath: false,
      stale: Math.max(timeoutMs * 2, 5000),
      retries: {
        retries: Math.max(1, Math.ceil(timeoutMs / retryIntervalMs)),
        factor: 1,
        minTimeout: retryIntervalMs,
        maxTimeout: retryIntervalMs,
      },
    });
    return await fn();
  } catch (error: unknown) {
    if (isLockConflict(error)) {
      throw new LockTimeoutError(lockTarget, timeoutMs);
    }
    throw error;
  } finally {
    if (release) {
      await release();
    }
  }
}

function isLockConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as Error & { code?: string }).code === 'ELOCKED'
  );
}
