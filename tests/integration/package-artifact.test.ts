import { describe, expect, it } from 'vitest';
import { access, copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TESTS_DIR, '../..');

async function expectFileExists(filePath: string): Promise<void> {
  await expect(access(filePath)).resolves.not.toThrow();
}

async function packRepository(packDir: string): Promise<string> {
  await execa('pnpm', ['pack', '--pack-destination', packDir], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      npm_config_foreground_scripts: 'true',
    },
  });

  const packedFiles = await readdir(packDir);
  const tarballs = packedFiles.filter((file) => file.endsWith('.tgz')).sort();
  expect(tarballs).toHaveLength(1);
  return path.join(packDir, tarballs[0]!);
}

describe('package artifact', () => {
  it('packs installable compiled bins and preset workflow assets', async () => {
    const packWorkspace = await createTempWorkspace();
    const consumerWorkspace = await createTempWorkspace();

    try {
      const tarball = await packRepository(packWorkspace.dir);
      const packageJson = JSON.parse(
        await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8')
      ) as { dependencies?: Record<string, string> };
      await writeFile(
        path.join(consumerWorkspace.dir, 'package.json'),
        JSON.stringify(
          {
            name: 'playspec-package-artifact-consumer',
            private: true,
            dependencies: {
              ...(packageJson.dependencies ?? {}),
              playspec: `file:${tarball}`,
            },
          },
          null,
          2
        )
      );
      await copyFile(
        path.join(REPO_ROOT, 'pnpm-lock.yaml'),
        path.join(consumerWorkspace.dir, 'pnpm-lock.yaml')
      );

      await execa('pnpm', ['install', '--prefer-offline', '--ignore-scripts'], {
        cwd: consumerWorkspace.dir,
      });

      const installedPackageRoot = path.join(consumerWorkspace.dir, 'node_modules', 'playspec');
      const expectedInstalledFiles = [
        'dist/cli/index.js',
        'dist/mcp/index.js',
        'dist/core/errors.js',
        'dist/storage/task-store.js',
        'dist/template/template-loader.js',
        'dist/workflow/workflow-registry.js',
        'dist/preset/preset-manager.js',
        'dist/utils/paths.js',
        'dist/migration/migration-runner.js',
        'dist/evolution/proposal-store.js',
        'dist/viewer/markdown-viewer.js',
        'dist/preset/assets/workflows/mono-spec/workflow.yaml',
        'dist/preset/assets/workflows/mono-spec/templates/tech_spec_draft.md',
      ];

      for (const expectedFile of expectedInstalledFiles) {
        await expectFileExists(path.join(installedPackageRoot, expectedFile));
      }

      const binPath = path.join(consumerWorkspace.dir, 'node_modules', '.bin', 'playspec');
      const mcpBinPath = path.join(installedPackageRoot, 'dist/mcp/index.js');
      const userWorkflowRoot = path.join(consumerWorkspace.dir, 'user-workflows');
      const initResult = await execa(binPath, ['init', '--preset', 'default'], {
        cwd: consumerWorkspace.dir,
        env: {
          ...process.env,
          PLAY_SPEC_USER_WORKFLOWS: userWorkflowRoot,
        },
        reject: false,
      });

      expect(initResult.exitCode).toBe(0);
      expect(initResult.stderr).not.toContain('ERR_PACKAGE_IMPORT_NOT_DEFINED');
      await expectFileExists(
        path.join(consumerWorkspace.dir, '.playspec/workflows/mono-spec/workflow.yaml')
      );

      const mcpResult = await execa('node', [mcpBinPath], {
        cwd: consumerWorkspace.dir,
        input: '',
        reject: false,
        timeout: 5000,
      });
      expect(mcpResult.exitCode).toBe(0);
      expect(mcpResult.stderr).not.toContain('ERR_PACKAGE_IMPORT_NOT_DEFINED');
      expect(mcpResult.stderr).not.toContain('Package import specifier');
    } finally {
      await Promise.all([packWorkspace.cleanup(), consumerWorkspace.cleanup()]);
    }
  }, 60_000);
});
