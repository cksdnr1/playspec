import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { WorkflowSource } from '#core/types.js';
import { WorkflowNotFoundError } from '#core/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface WorkflowLocation {
  id: string;
  rootDir: string;
  workflowFile: string;
  templateDir: string;
  source: WorkflowSource;
}

export class WorkflowRegistry {
  private readonly builtinRoot: string;
  private readonly userRoot: string;

  constructor(private readonly workspaceRoot: string) {
    this.builtinRoot = path.resolve(__dirname, '..', 'preset', 'assets', 'workflows');
    this.userRoot = process.env['PLAY_SPEC_USER_WORKFLOWS'] ?? path.join(homedir(), '.playspec', 'workflows');
  }

  async resolve(workflowId: string): Promise<WorkflowLocation> {
    for (const source of ['user', 'builtin'] as const) {
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
    const locations = [
      ...(await this.listFromRoot(this.builtinRoot, 'builtin')),
      ...(await this.listFromRoot(this.userRoot, 'user')),
    ];
    return locations.sort((a, b) => a.id.localeCompare(b.id));
  }

  getBuiltinRoot(): string {
    return this.builtinRoot;
  }

  getUserRoot(): string {
    return this.userRoot;
  }

  private rootFor(source: WorkflowSource, workflowId: string): string {
    return path.join(source === 'builtin' ? this.builtinRoot : this.userRoot, workflowId);
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
