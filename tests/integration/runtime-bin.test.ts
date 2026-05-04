import { describe, it, expect, beforeAll } from 'vitest';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, '../..');
const CLI_BIN = path.join(REPO_ROOT, 'dist/cli/index.js');
const MCP_BIN = path.join(REPO_ROOT, 'dist/mcp/index.js');

beforeAll(async () => {
  await execa('pnpm', ['build'], { cwd: REPO_ROOT });
}, 30_000);

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      if (/\.[jt]s$/.test(entry.name)) {
        return [entryPath];
      }

      return [];
    })
  );

  return files.flat();
}

async function collectAliasFamilies(root: string): Promise<Set<string>> {
  const families = new Set<string>();
  const files = await collectFiles(root);

  for (const file of files) {
    const contents = await readFile(file, 'utf8');
    for (const match of contents.matchAll(/#[a-z]+\/[^'"\s]+\.js/g)) {
      const [family] = match[0].split('/');
      families.add(`${family}/*.js`);
    }
  }

  return families;
}

describe('package runtime bins', () => {
  it('mirrors compile-time aliases and covers every emitted runtime alias family', async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8')
    ) as { imports?: Record<string, string> };
    const tsconfig = JSON.parse(
      await readFile(path.join(REPO_ROOT, 'tsconfig.json'), 'utf8')
    ) as { compilerOptions?: { paths?: Record<string, string[]> } };
    const importKeys = new Set(Object.keys(packageJson.imports ?? {}));
    const pathKeys = new Set(Object.keys(tsconfig.compilerOptions?.paths ?? {}));
    const aliasFamilies = new Set([
      ...(await collectAliasFamilies(path.join(REPO_ROOT, 'src'))),
      ...(await collectAliasFamilies(path.join(REPO_ROOT, 'dist'))),
    ]);

    expect([...importKeys].sort()).toEqual([...pathKeys].sort());
    for (const family of aliasFamilies) {
      expect(importKeys).toContain(family);
    }
  });

  it('prints CLI help through the compiled package entrypoint', async () => {
    const workspace = await createTempWorkspace();

    try {
      const result = await execa('node', [CLI_BIN, '--help'], {
        cwd: workspace.dir,
        reject: false,
      });
      const output = result.stdout + result.stderr;

      expect(result.exitCode).toBe(0);
      expect(output).toMatch(/playspec/i);
      expect(output).not.toContain('ERR_PACKAGE_IMPORT_NOT_DEFINED');
    } finally {
      await workspace.cleanup();
    }
  });

  it('initializes an external workspace through the compiled CLI entrypoint', async () => {
    const workspace = await createTempWorkspace();
    const userWorkflowRoot = path.join(workspace.dir, 'user-workflows');

    try {
      const result = await execa('node', [CLI_BIN, 'init', '--preset', 'default'], {
        cwd: workspace.dir,
        env: {
          ...process.env,
          PLAY_SPEC_USER_WORKFLOWS: userWorkflowRoot,
        },
        reject: false,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toContain('ERR_PACKAGE_IMPORT_NOT_DEFINED');
      await expect(access(path.join(workspace.dir, '.playspec/HEAD'))).resolves.not.toThrow();
      await expect(access(path.join(workspace.dir, '.playspec', 'workflows', 'mono-spec', 'workflow.yaml'))).resolves.not.toThrow();
      await expect(access(path.join(userWorkflowRoot, 'mono-spec', 'workflow.yaml'))).rejects.toThrow();
    } finally {
      await workspace.cleanup();
    }
  });

  it('starts the compiled MCP bin without package import resolution errors', async () => {
    const workspace = await createTempWorkspace();

    try {
      const result = await execa('node', [MCP_BIN], {
        cwd: workspace.dir,
        input: '',
        reject: false,
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toContain('ERR_PACKAGE_IMPORT_NOT_DEFINED');
      expect(result.stderr).not.toContain('Package import specifier');
    } finally {
      await workspace.cleanup();
    }
  });
});
