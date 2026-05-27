import { execa } from 'execa';
import { TextDecoder } from 'node:util';

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
      this.run(['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    ]);

    return {
      head,
      branchStatus,
      entries: parsePorcelainZ(porcelain),
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
    const output = await this.run(['diff', '--name-status', '-z', `${baseHead}..HEAD`]);
    return parseNameStatusZ(output);
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
  if (output.includes('\0')) {
    return parseNulPorcelain(output);
  }

  return output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const code = line.slice(0, 2);
      const rawPath = line.slice(3);
      if (isRenameOrCopyStatus(code)) {
        const renamePaths = parseRenamePorcelainPaths(rawPath);
        if (renamePaths) {
          const [originalPath, nextPath] = renamePaths;
          return { code, path: nextPath, originalPath };
        }
      }
      return { code, path: decodePorcelainPath(rawPath) };
    });
}

function parseNulPorcelain(output: string): GitStatusEntry[] {
  const fields = output.split('\0').filter((field) => field.length > 0);
  const entries: GitStatusEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const code = field.slice(0, 2);
    const path = field.slice(3);

    if (isRenameOrCopyStatus(code)) {
      const originalPath = fields[index + 1];
      if (originalPath !== undefined) {
        entries.push({ code, path, originalPath });
        index += 1;
        continue;
      }
    }

    entries.push({ code, path });
  }

  return entries;
}

function isRenameOrCopyStatus(code: string): boolean {
  return code.includes('R') || code.includes('C');
}

function parseRenamePorcelainPaths(rawPath: string): [string, string] | null {
  if (!rawPath.startsWith('"')) {
    const separatorIndex = rawPath.indexOf(' -> ');
    if (separatorIndex === -1) {
      return null;
    }

    return [
      rawPath.slice(0, separatorIndex),
      rawPath.slice(separatorIndex + ' -> '.length),
    ];
  }

  const first = parsePorcelainPathToken(rawPath);
  if (!first) {
    return null;
  }

  const separator = ' -> ';
  if (!rawPath.slice(first.consumed).startsWith(separator)) {
    return null;
  }

  const secondRaw = rawPath.slice(first.consumed + separator.length);
  const second = parsePorcelainPathToken(secondRaw);
  if (!second || second.consumed !== secondRaw.length) {
    return null;
  }

  return [first.path, second.path];
}

function decodePorcelainPath(rawPath: string): string {
  const parsed = parsePorcelainPathToken(rawPath);
  return parsed && parsed.consumed === rawPath.length ? parsed.path : rawPath;
}

function parsePorcelainPathToken(rawPath: string): { path: string; consumed: number } | null {
  if (!rawPath.startsWith('"')) {
    return {
      path: rawPath,
      consumed: rawPath.length,
    };
  }

  const decoder = new TextDecoder();
  let path = '';
  let octalBytes: number[] = [];
  const flushOctalBytes = () => {
    if (octalBytes.length === 0) {
      return;
    }
    path += decoder.decode(new Uint8Array(octalBytes));
    octalBytes = [];
  };

  for (let index = 1; index < rawPath.length; index += 1) {
    const character = rawPath[index];
    if (character === '"') {
      flushOctalBytes();
      return { path, consumed: index + 1 };
    }

    if (character !== '\\') {
      flushOctalBytes();
      path += character;
      continue;
    }

    const next = rawPath[index + 1];
    if (next === undefined) {
      return null;
    }

    if (isOctalDigit(next)) {
      let octal = next;
      let offset = 2;
      while (offset <= 3 && isOctalDigit(rawPath[index + offset])) {
        octal += rawPath[index + offset];
        offset += 1;
      }
      octalBytes.push(Number.parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    const decoded = decodeCStyleEscape(next);
    if (decoded === null) {
      return null;
    }

    flushOctalBytes();
    path += decoded;
    index += 1;
  }

  return null;
}

function decodeCStyleEscape(character: string): string | null {
  switch (character) {
    case 'a':
      return '\x07';
    case 'b':
      return '\b';
    case 'f':
      return '\f';
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case 'v':
      return '\v';
    case '\\':
      return '\\';
    case '"':
      return '"';
    default:
      return null;
  }
}

function isOctalDigit(character: string | undefined): boolean {
  return character !== undefined && character >= '0' && character <= '7';
}

export function statusEntryPathList(entries: GitStatusEntry[]): string {
  return entries
    .map((entry) => entry.originalPath ? `${entry.originalPath} -> ${entry.path}` : entry.path)
    .join('\n');
}

export function parsePorcelainZ(output: string): GitStatusEntry[] {
  const fields = splitNulFields(output);
  const entries: GitStatusEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const record = fields[index];
    const code = record.slice(0, 2);
    const path = record.slice(3);

    if (isRenameOrCopyCode(code)) {
      const originalPath = fields[index + 1];
      if (originalPath !== undefined) {
        entries.push({ code, originalPath, path });
        index += 1;
        continue;
      }
    }

    entries.push({ code, path });
  }

  return entries;
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

export function parseNameStatusZ(output: string): GitNameStatusEntry[] {
  const fields = splitNulFields(output);
  const entries: GitNameStatusEntry[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const code = fields[index];
    const firstPath = fields[index + 1];
    if (firstPath === undefined) {
      break;
    }

    if (isRenameOrCopyCode(code)) {
      const secondPath = fields[index + 2];
      if (secondPath === undefined) {
        break;
      }
      entries.push({ code, originalPath: firstPath, path: secondPath });
      index += 2;
      continue;
    }

    entries.push({ code, path: firstPath });
    index += 1;
  }

  return entries;
}

function splitNulFields(output: string): string[] {
  return output.split('\0').filter((field) => field.length > 0);
}

function isRenameOrCopyCode(code: string): boolean {
  return code.startsWith('R') || code.startsWith('C');
}
