import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, readdir } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { PackManifestSchema, PACK_MANIFEST_FILE } from './pack-schema.js';
import type { PackManifest } from './pack-schema.js';
import { WorkflowDefinitionSchema } from '#core/schemas.js';
import { PlaySpecError, WorkflowNotFoundError } from '#core/errors.js';
import { readTextFile } from '#utils/fs.js';
import { getPlayspecRoot, getUserPacksRoot } from '#utils/paths.js';
import type { WorkflowDefinition, WorkflowPackRef } from '#core/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ResolvedWorkflow {
  workflow: WorkflowDefinition;
  workflowPath: string;
  templateRoot: string;
  includeRoot: string;
  packRoot: string;
  packRef?: WorkflowPackRef;
  packVariables?: Record<string, { default?: string; description?: string; required?: boolean }>;
  workflowVariables?: Record<string, { default?: string; description?: string; required?: boolean }>;
}

export interface InstalledPackInfo {
  manifest: PackManifest;
  root: string;
}

export class WorkflowPackRegistry {
  constructor(
    private readonly workspaceRoot: string,
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  async validatePackRoot(packRoot: string): Promise<PackManifest> {
    const manifestPath = path.join(packRoot, PACK_MANIFEST_FILE);
    const raw = parseYaml(await readTextFile(manifestPath)) as unknown;
    const manifest = PackManifestSchema.parse(raw);
    for (const [workflowId, entry] of Object.entries(manifest.workflows)) {
      await this.assertInsideRoot(packRoot, entry.path, `workflow ${workflowId}`);
    }
    await this.assertInsideRoot(packRoot, manifest.templates?.root ?? 'templates', 'template root');
    await this.assertInsideRoot(packRoot, manifest.rules?.root ?? 'rules', 'rules root', true);
    return manifest;
  }

  async listInstalledPacks(): Promise<InstalledPackInfo[]> {
    const packsRoot = getUserPacksRoot(this.env);
    let packIds: string[];
    try {
      packIds = await readdir(packsRoot);
    } catch {
      return [];
    }

    const packs: InstalledPackInfo[] = [];
    for (const packId of packIds.sort()) {
      const versions = await this.listInstalledVersions(packId);
      for (const version of versions) {
        const root = path.join(packsRoot, packId, version);
        try {
          packs.push({ root, manifest: await this.validatePackRoot(root) });
        } catch {
          // Ignore unreadable installed entries.
        }
      }
    }
    return packs;
  }

  async resolveInstalledPack(packId: string, version?: string): Promise<InstalledPackInfo> {
    if (packId === 'default') {
      const root = this.defaultPackRoot();
      return { root, manifest: await this.validatePackRoot(root) };
    }

    const versions = await this.listInstalledVersions(packId);
    const selectedVersion = version ?? versions.at(-1);
    if (!selectedVersion) {
      throw new PlaySpecError(
        `Pack not installed: ${packId}`,
        'Install it with `playspec pack install <dir-or-archive>` or use an existing installed pack id.'
      );
    }

    const root = path.join(getUserPacksRoot(this.env), packId, selectedVersion);
    return { root, manifest: await this.validatePackRoot(root) };
  }

  async resolveWorkflow(workflowId: string, packRef?: WorkflowPackRef): Promise<ResolvedWorkflow> {
    if (!packRef) {
      return this.resolveProjectWorkflow(workflowId);
    }

    const source = await this.resolveInstalledPack(packRef.id, packRef.version);
    const workflowEntry = source.manifest.workflows[workflowId];
    if (!workflowEntry) {
      throw new WorkflowNotFoundError(`${source.root}/${PACK_MANIFEST_FILE}#workflows.${workflowId}`);
    }

    const workflowPath = path.join(source.root, workflowEntry.path);
    const raw = parseYaml(await readTextFile(workflowPath)) as unknown;
    const workflow = WorkflowDefinitionSchema.parse(raw);
    const templateRoot = path.join(source.root, source.manifest.templates?.root ?? 'templates');

    return {
      workflow,
      workflowPath,
      templateRoot,
      includeRoot: source.root,
      packRoot: source.root,
      packRef: {
        id: source.manifest.id,
        version: source.manifest.version,
        source: source.manifest.id === 'default' ? 'builtin' : 'user',
      },
      packVariables: source.manifest.variables,
      workflowVariables: workflowEntry.variables,
    };
  }

  private async resolveProjectWorkflow(workflowId: string): Promise<ResolvedWorkflow> {
    const playspecRoot = getPlayspecRoot(this.workspaceRoot);
    const workflowPath = path.join(playspecRoot, 'workflows', `${workflowId}.yaml`);
    try {
      const raw = parseYaml(await readTextFile(workflowPath)) as unknown;
      const workflow = WorkflowDefinitionSchema.parse(raw);
      let packVariables: ResolvedWorkflow['packVariables'];
      const manifestPath = path.join(playspecRoot, PACK_MANIFEST_FILE);
      try {
        const rawManifest = parseYaml(await readTextFile(manifestPath)) as unknown;
        packVariables = PackManifestSchema.parse(rawManifest).variables;
      } catch {
        packVariables = undefined;
      }
      return {
        workflow,
        workflowPath,
        templateRoot: path.join(playspecRoot, 'templates'),
        includeRoot: playspecRoot,
        packRoot: playspecRoot,
        packVariables,
      };
    } catch {
      const source = await this.resolveInstalledPack('default');
      const workflowEntry = source.manifest.workflows[workflowId];
      if (!workflowEntry) {
        throw new WorkflowNotFoundError(workflowPath);
      }
      return this.resolveWorkflow(workflowId, { id: 'default', version: source.manifest.version, source: 'builtin' });
    }
  }

  private async listInstalledVersions(packId: string): Promise<string[]> {
    try {
      const versions = await readdir(path.join(getUserPacksRoot(this.env), packId));
      return versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } catch {
      return [];
    }
  }

  private defaultPackRoot(): string {
    return path.resolve(__dirname, '..', 'preset', 'assets', 'default');
  }

  private async assertInsideRoot(
    packRoot: string,
    relativePath: string,
    label: string,
    allowMissing = false
  ): Promise<void> {
    if (path.isAbsolute(relativePath)) {
      throw new PlaySpecError(`Invalid pack ${label} path: ${relativePath}`, 'Pack paths must be relative to the pack root.');
    }
    const resolved = path.resolve(packRoot, relativePath);
    const relative = path.relative(packRoot, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new PlaySpecError(`Invalid pack ${label} path: ${relativePath}`, 'Pack paths must stay inside the pack root.');
    }
    if (!allowMissing) {
      await access(resolved);
    }
  }
}
