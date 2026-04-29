import path from 'node:path';
import type { Command } from 'commander';
import { PackInstaller } from '#pack/pack-installer.js';
import { WorkflowPackRegistry } from '#pack/pack-registry.js';

export function registerPackCommands(
  program: Command,
  handleError: (err: unknown) => never
): void {
  const pack = program
    .command('pack')
    .description('Manage workflow/template packs');

  pack
    .command('validate <dir>')
    .description('Validate a workflow/template pack directory')
    .action(async (dir: string) => {
      try {
        const manifest = await new PackInstaller(process.cwd()).validate(dir);
        console.log(`Valid pack: ${manifest.id}@${manifest.version}`);
      } catch (err) {
        handleError(err);
      }
    });

  pack
    .command('install <source>')
    .description('Install a workflow/template pack directory or .tgz archive')
    .action(async (source: string) => {
      try {
        const result = await new PackInstaller(process.cwd()).install(source);
        console.log(`Installed pack: ${result.manifest.id}@${result.manifest.version}`);
        console.log(`Location: ${result.installRoot}`);
      } catch (err) {
        handleError(err);
      }
    });

  pack
    .command('list')
    .description('List installed workflow/template packs')
    .action(async () => {
      try {
        const packs = await new WorkflowPackRegistry(process.cwd()).listInstalledPacks();
        if (packs.length === 0) {
          console.log('No user packs installed.');
          return;
        }
        for (const packInfo of packs) {
          console.log(`${packInfo.manifest.id}@${packInfo.manifest.version}\t${packInfo.manifest.name}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  pack
    .command('show <packId>')
    .description('Show an installed workflow/template pack')
    .option('--version <version>', 'Pack version to show')
    .action(async (packId: string, opts: { version?: string }) => {
      try {
        const packInfo = await new WorkflowPackRegistry(process.cwd()).resolveInstalledPack(packId, opts.version);
        console.log(`${packInfo.manifest.name} (${packInfo.manifest.id}@${packInfo.manifest.version})`);
        if (packInfo.manifest.description) {
          console.log(packInfo.manifest.description);
        }
        console.log(`Location: ${packInfo.root}`);
        console.log('Workflows:');
        for (const workflowId of Object.keys(packInfo.manifest.workflows).sort()) {
          console.log(`  - ${workflowId}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  pack
    .command('export <packId>')
    .description('Export an installed pack as a shareable .tgz archive')
    .requiredOption('--out <archive.tgz>', 'Output archive path')
    .option('--version <version>', 'Pack version to export')
    .action(async (packId: string, opts: { out: string; version?: string }) => {
      try {
        const result = await new PackInstaller(process.cwd()).export(packId, opts.out, opts.version);
        console.log(`Exported pack: ${result.manifest.id}@${result.manifest.version}`);
        console.log(`Archive: ${path.relative(process.cwd(), result.outFile)}`);
      } catch (err) {
        handleError(err);
      }
    });

  pack
    .command('remove <packId>')
    .description('Remove an installed workflow/template pack')
    .option('--version <version>', 'Pack version to remove')
    .action(async (packId: string, opts: { version?: string }) => {
      try {
        const removed = await new PackInstaller(process.cwd()).remove(packId, opts.version);
        for (const target of removed) {
          console.log(`Removed: ${target}`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
