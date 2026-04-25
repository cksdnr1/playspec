#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import chalk from 'chalk';
import { PlaySpecError } from '#core/errors.js';
import { runInit } from './commands/init.js';
import { runCreate } from './commands/create.js';
import { runList } from './commands/list.js';
import { runCurrent } from './commands/current.js';
import { runUse } from './commands/use.js';
import { runNext } from './commands/next.js';
import { runPhase } from './commands/phase.js';
import { runComplete } from './commands/complete.js';
import { runEvidence } from './commands/evidence.js';
import { runSnapshot } from './commands/snapshot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Read version from package.json
const pkg = require('../../package.json') as { version: string };

function handleError(err: unknown): never {
  if (err instanceof PlaySpecError) {
    console.error(chalk.red(`Error: ${err.message}`));
    if (err.hint) {
      console.error(chalk.yellow(`Hint: ${err.hint}`));
    }
  } else if (err instanceof Error) {
    console.error(chalk.red(`Error: ${err.message}`));
  } else {
    console.error(chalk.red('An unexpected error occurred.'));
  }
  process.exit(1);
}

const program = new Command();

program
  .name('playspec')
  .description('PlaySpec — LLM workflow engine')
  .version(pkg.version);

// init
program
  .command('init')
  .description('Initialize a .playspec workspace')
  .option('--preset <name>', 'Preset to use', 'default')
  .action(async (opts: { preset: string }) => {
    try {
      await runInit(process.cwd(), opts.preset);
    } catch (err) {
      handleError(err);
    }
  });

// create
program
  .command('create <workflowType> <title>')
  .description('Create a new task')
  .action(async (workflowType: string, title: string) => {
    try {
      await runCreate(process.cwd(), workflowType, title);
    } catch (err) {
      handleError(err);
    }
  });

// list
program
  .command('list')
  .description('List all active tasks')
  .action(async () => {
    try {
      await runList(process.cwd());
    } catch (err) {
      handleError(err);
    }
  });

// current
program
  .command('current')
  .description('Show the current active task (from HEAD)')
  .action(async () => {
    try {
      await runCurrent(process.cwd());
    } catch (err) {
      handleError(err);
    }
  });

// use
program
  .command('use <taskId>')
  .description('Set the active task by ID')
  .action(async (taskId: string) => {
    try {
      await runUse(process.cwd(), taskId);
    } catch (err) {
      handleError(err);
    }
  });

// next
program
  .command('next')
  .description('Render the next phase prompt for the active task')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--write', 'Write prompt to prompts/ directory', false)
  .action(async (opts: { task?: string; write: boolean }) => {
    try {
      await runNext(process.cwd(), opts.task, opts.write);
    } catch (err) {
      handleError(err);
    }
  });

// phase
program
  .command('phase <phaseId>')
  .description('Render a specific phase prompt for the active task')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .action(async (phaseId: string, opts: { task?: string }) => {
    try {
      await runPhase(process.cwd(), phaseId, opts.task);
    } catch (err) {
      handleError(err);
    }
  });

// complete
program
  .command('complete')
  .description('Complete the current workflow phase for the active task')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--with-review', 'Persist a review record', false)
  .action(async (opts: { task?: string; withReview: boolean }) => {
    try {
      await runComplete(process.cwd(), opts.task, opts.withReview);
    } catch (err) {
      handleError(err);
    }
  });

// evidence
program
  .command('evidence')
  .description('Collect git evidence for the current workflow phase')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .action(async (opts: { task?: string }) => {
    try {
      await runEvidence(process.cwd(), opts.task);
    } catch (err) {
      handleError(err);
    }
  });

// snapshot
program
  .command('snapshot')
  .description('Create task and prompt snapshots for the current workflow phase')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .action(async (opts: { task?: string }) => {
    try {
      await runSnapshot(process.cwd(), opts.task);
    } catch (err) {
      handleError(err);
    }
  });

program.parse(process.argv);
