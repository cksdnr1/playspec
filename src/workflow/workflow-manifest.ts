import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { writeTextFileAtomic } from '#utils/fs.js';

export const BASELINE_FILE = '.playspec-baseline.json';
export const WorkflowBaselineSchema = z.object({ version: z.literal(1), files: z.record(z.string().regex(/^[a-f0-9]{64}$/)) });
export async function workflowFiles(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(relative: string) {
    for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if ([BASELINE_FILE, '.playspec-updates', '.DS_Store'].includes(entry.name)) continue;
      const file = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Workflow assets must not be symlinks: ${file}`);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) result[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
    }
  }
  await walk(''); return result;
}
export async function writeWorkflowBaseline(root: string, files: Record<string, string>): Promise<void> {
  await writeTextFileAtomic(path.join(root, BASELINE_FILE), JSON.stringify({ version: 1, files }, null, 2) + '\n');
}
