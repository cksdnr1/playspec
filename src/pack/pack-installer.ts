import { cp, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execa } from 'execa';
import { PACK_MANIFEST_FILE } from './pack-schema.js';
import type { PackManifest } from './pack-schema.js';
import { WorkflowPackRegistry } from './pack-registry.js';
import { PlaySpecError } from '#core/errors.js';
import { getUserPackRoot, getUserPacksRoot } from '#utils/paths.js';

export class PackInstaller {
  private readonly registry: WorkflowPackRegistry;

  constructor(
    private readonly workspaceRoot: string,
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {
    this.registry = new WorkflowPackRegistry(workspaceRoot, env);
  }

  async validate(sourcePath: string): Promise<PackManifest> {
    const packRoot = await this.resolvePackRoot(sourcePath);
    return this.registry.validatePackRoot(packRoot);
  }

  async install(sourcePath: string): Promise<{ manifest: PackManifest; installRoot: string }> {
    const tempRoot = await this.unpackIfArchive(sourcePath);
    try {
      const packRoot = await this.resolvePackRoot(tempRoot ?? sourcePath);
      const manifest = await this.registry.validatePackRoot(packRoot);
      const installRoot = getUserPackRoot(manifest.id, manifest.version, this.env);
      await rm(installRoot, { recursive: true, force: true });
      await mkdir(path.dirname(installRoot), { recursive: true });
      await cp(packRoot, installRoot, { recursive: true });
      return { manifest, installRoot };
    } finally {
      if (tempRoot) {
        await rm(tempRoot, { recursive: true, force: true });
      }
    }
  }

  async remove(packId: string, version?: string): Promise<string[]> {
    if (packId === 'default') {
      throw new PlaySpecError('Cannot remove built-in pack "default".');
    }
    const root = path.join(getUserPacksRoot(this.env), packId);
    const removed: string[] = [];
    if (version) {
      const target = path.join(root, version);
      await rm(target, { recursive: true, force: true });
      removed.push(target);
      return removed;
    }
    await rm(root, { recursive: true, force: true });
    removed.push(root);
    return removed;
  }

  async export(packId: string, outFile: string, version?: string): Promise<{ manifest: PackManifest; outFile: string }> {
    const source = await this.registry.resolveInstalledPack(packId, version);
    const resolvedOut = path.resolve(this.workspaceRoot, outFile);
    await mkdir(path.dirname(resolvedOut), { recursive: true });
    await execa('tar', ['-czf', resolvedOut, '-C', source.root, '.']);
    return { manifest: source.manifest, outFile: resolvedOut };
  }

  private async resolvePackRoot(inputPath: string): Promise<string> {
    const resolved = path.resolve(this.workspaceRoot, inputPath);
    const entry = await stat(resolved);
    if (!entry.isDirectory()) {
      throw new PlaySpecError(
        `Pack source is not a directory: ${inputPath}`,
        'Pass a pack directory or a .tgz archive produced by `playspec pack export`.'
      );
    }

    if (await hasManifest(resolved)) {
      return resolved;
    }

    const entries = await readdir(resolved, { withFileTypes: true });
    const dirs = entries.filter((entry) => entry.isDirectory());
    if (dirs.length === 1) {
      const nested = path.join(resolved, dirs[0].name);
      if (await hasManifest(nested)) {
        return nested;
      }
    }

    throw new PlaySpecError(
      `Pack manifest not found in: ${inputPath}`,
      `Expected ${PACK_MANIFEST_FILE} at the source root.`
    );
  }

  private async unpackIfArchive(sourcePath: string): Promise<string | undefined> {
    if (!sourcePath.endsWith('.tgz') && !sourcePath.endsWith('.tar.gz')) {
      return undefined;
    }

    const archivePath = path.resolve(this.workspaceRoot, sourcePath);
    await this.assertArchiveEntriesSafe(archivePath);
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'playspec-pack-'));
    await execa('tar', ['-xzf', archivePath, '-C', tempRoot]);
    return tempRoot;
  }

  private async assertArchiveEntriesSafe(archivePath: string): Promise<void> {
    const result = await execa('tar', ['-tzf', archivePath]);
    const unsafe = result.stdout
      .split('\n')
      .filter(Boolean)
      .find((entry) => {
        const normalized = path.posix.normalize(entry);
        return normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized);
      });
    if (unsafe) {
      throw new PlaySpecError(
        `Unsafe pack archive entry: ${unsafe}`,
        'Archive entries must be relative paths that stay inside the pack root.'
      );
    }
  }
}

async function hasManifest(dirPath: string): Promise<boolean> {
  try {
    const manifest = await stat(path.join(dirPath, PACK_MANIFEST_FILE));
    return manifest.isFile();
  } catch {
    return false;
  }
}
