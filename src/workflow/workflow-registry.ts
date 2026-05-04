import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { WorkflowSource } from '#core/types.js';
import { WorkflowNotFoundError } from '#core/errors.js';
import { getProjectWorkflowsRoot } from '#utils/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ORDER: readonly WorkflowSource[] = ['project', 'user', 'builtin'];
const SOURCE_RANK = new Map<WorkflowSource, number>(SOURCE_ORDER.map((source, index) => [source, index]));

export interface WorkflowLocation {
  id: string;
  rootDir: string;
  workflowFile: string;
  templateDir: string;
  source: WorkflowSource;
}

export class WorkflowRegistry {
  private readonly builtinRoot: string;
  private readonly projectRoot: string;
  private readonly userRoot: string;

  constructor(private readonly workspaceRoot: string) {
    this.builtinRoot = path.resolve(__dirname, '..', 'preset', 'assets', 'workflows');
    this.projectRoot = getProjectWorkflowsRoot(workspaceRoot);
    this.userRoot = process.env['PLAY_SPEC_USER_WORKFLOWS'] ?? path.join(homedir(), '.playspec', 'workflows');
  }

  async resolve(workflowId: string): Promise<WorkflowLocation> {
    for (const source of SOURCE_ORDER) {
      const rootDir = this.rootFor(source, workflowId);
      const workflowFile = path.join(rootDir, 'workflow.yaml');
      try {
        await access(workflowFile);
        return {
          id: workflowId,
          rootDir,
          workflowFile,
          templateDir: path.join(rootDir, 'templates'),
          source,
        };
      } catch {
        // Try next source.
      }
    }

    throw new WorkflowNotFoundError(workflowId);
  }

  async list(): Promise<WorkflowLocation[]> {
    const effective = new Map<string, WorkflowLocation>();
    for (const source of SOURCE_ORDER) {
      const locations = await this.listFromRoot(this.rootForSource(source), source);
      for (const location of locations) {
        if (!effective.has(location.id)) {
          effective.set(location.id, location);
        }
      }
    }

    return [...effective.values()].sort((a, b) => {
      const sourceDiff = (SOURCE_RANK.get(a.source) ?? 0) - (SOURCE_RANK.get(b.source) ?? 0);
      return sourceDiff === 0 ? a.id.localeCompare(b.id) : sourceDiff;
    });
  }

  getBuiltinRoot(): string {
    return this.builtinRoot;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getUserRoot(): string {
    return this.userRoot;
  }

  private rootFor(source: WorkflowSource, workflowId: string): string {
    return path.join(this.rootForSource(source), workflowId);
  }

  private rootForSource(source: WorkflowSource): string {
    if (source === 'project') return this.projectRoot;
    if (source === 'user') return this.userRoot;
    return this.builtinRoot;
  }

  private async listFromRoot(root: string, source: WorkflowSource): Promise<WorkflowLocation[]> {
    let entries: string[];
    try {
      entries = await readdir(root);
    } catch {
      return [];
    }

    const locations: WorkflowLocation[] = [];
    for (const entry of entries) {
      const rootDir = path.join(root, entry);
      const workflowFile = path.join(rootDir, 'workflow.yaml');
      try {
        await access(workflowFile);
        locations.push({
          id: entry,
          rootDir,
          workflowFile,
          templateDir: path.join(rootDir, 'templates'),
          source,
        });
      } catch {
        // Skip invalid entries.
      }
    }
    return locations;
  }
}
