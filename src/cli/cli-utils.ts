import path from 'node:path';
import { mkdir, realpath } from 'node:fs/promises';
import { PlaySpecError } from '#core/errors.js';
import { readTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';
import type { TaskContextRef } from '#core/types.js';

export function isInteractiveCli(): boolean {
  const forced = process.env.PLAY_SPEC_NON_INTERACTIVE;
  const forcedNonInteractive =
    forced !== undefined && forced !== '' && forced !== '0' && forced.toLowerCase() !== 'false';
  return process.stdin.isTTY === true && process.stdout.isTTY === true && !process.env.CI && !forcedNonInteractive;
}

export async function readHeadTaskId(workspaceRoot: string): Promise<string | null> {
  try {
    const content = await readTextFile(getHeadPath(workspaceRoot));
    return content.trim() || null;
  } catch {
    return null;
  }
}

export function formatContextRef(ref: TaskContextRef): string {
  return `${ref.path} (${ref.role}, source: ${ref.source})`;
}

export async function resolveOutputFilePath(workspaceRoot: string, outputPath: string): Promise<string> {
  const workspaceRealPath = await realpath(workspaceRoot);
  const resolvedPath = path.isAbsolute(outputPath)
    ? path.normalize(outputPath)
    : path.resolve(workspaceRealPath, outputPath);

  if (!path.isAbsolute(outputPath)) {
    const relativePath = path.relative(workspaceRealPath, resolvedPath);
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new PlaySpecError(
        `Output path escapes workspace: ${outputPath}`,
        'Use a workspace-relative path that stays inside the workspace.'
      );
    }
  }

  const parentDir = path.dirname(resolvedPath);
  await mkdir(parentDir, { recursive: true });

  if (!path.isAbsolute(outputPath)) {
    const realParent = await realpath(parentDir);
    const parentRelativePath = path.relative(workspaceRealPath, realParent);
    if (
      parentRelativePath === '..' ||
      parentRelativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(parentRelativePath)
    ) {
      throw new PlaySpecError(
        `Output path escapes workspace through a symlink: ${outputPath}`,
        'Choose an output path whose parent directory resolves inside the workspace.'
      );
    }
  }

  return resolvedPath;
}
