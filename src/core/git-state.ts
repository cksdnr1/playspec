import { execa } from 'execa';

export interface GitStatusEntry {
  code: string;
  path: string;
  originalPath?: string;
}

export interface GitNameStatusEntry {
  code: string;
  path: string;
  originalPath?: string;
}

export interface GitWorkspaceState {
  head: string | null;
  branchStatus: string;
  entries: GitStatusEntry[];
}

export class GitState {
  constructor(private readonly workspaceRoot: string) {}

  async getCurrentHead(): Promise<string | null> {
    try {
      return await this.run(['rev-parse', 'HEAD']);
    } catch {
      return null;
    }
  }

  async getWorkspaceState(): Promise<GitWorkspaceState> {
    const [head, branchStatus, porcelain] = await Promise.all([
      this.getCurrentHead(),
      this.run(['status', '--short', '--branch', '--untracked-files=all']),
      this.run(['status', '--porcelain', '--untracked-files=all']),
    ]);

    return {
      head,
      branchStatus,
      entries: parsePorcelain(porcelain),
    };
  }

  async getDiffStat(): Promise<string> {
    return this.run(['diff', '--stat', '--no-ext-diff']);
  }

  async listCommitsAfter(baseHead: string): Promise<string[]> {
    const output = await this.run(['rev-list', '--oneline', `${baseHead}..HEAD`]);
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  }

  async listNameStatusSince(baseHead: string): Promise<GitNameStatusEntry[]> {
    const output = await this.run(['diff', '--name-status', `${baseHead}..HEAD`]);
    return parseNameStatus(output);
  }

  async run(args: string[]): Promise<string> {
    const result = await execa('git', args, {
      cwd: this.workspaceRoot,
      reject: true,
    });
    return result.stdout;
  }
}

export function parsePorcelain(output: string): GitStatusEntry[] {
  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      const rawPath = line.slice(3);
      if (rawPath.includes(' -> ')) {
        const [originalPath, nextPath] = rawPath.split(' -> ');
        return { code, path: nextPath, originalPath };
      }
      return { code, path: rawPath };
    });
}

export function statusEntryPathList(entries: GitStatusEntry[]): string {
  return entries.map((entry) => entry.path).join('\n');
}

export function parseNameStatus(output: string): GitNameStatusEntry[] {
  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const code = parts[0];
      if (code.startsWith('R')) {
        return { code, originalPath: parts[1], path: parts[2] };
      }
      return { code, path: parts[1] };
    });
}
