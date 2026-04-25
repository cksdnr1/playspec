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
import { runDesyncCheck } from './commands/desync-check.js';
import { runRollback } from './commands/rollback.js';
import { runStatus } from './commands/status.js';
import { runMigrate } from './commands/migrate.js';

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
  .option('--phase <n>', 'Target workflow phase for phase-execution tasks')
  .option('--from <taskId>', 'Planning task ID to bind context from')
  .action(async (workflowType: string, title: string, opts: { phase?: string; from?: string }) => {
    try {
      await runCreate(process.cwd(), workflowType, title, opts);
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
  .option('--quiet', 'Suppress the compact Context Header', false)
  .action(async (opts: { task?: string; write: boolean; quiet: boolean }) => {
    try {
      await runNext(process.cwd(), opts.task, opts.write, opts.quiet);
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
  .option('--quiet', 'Suppress the compact Context Header', false)
  .option('--result <value>', 'Result value for result-bearing phases (required in non-interactive mode)')
  .action(async (opts: { task?: string; withReview: boolean; quiet: boolean; result?: string }) => {
    try {
      await runComplete(process.cwd(), opts.task, opts.withReview, opts.quiet, opts.result);
    } catch (err) {
      handleError(err);
    }
  });

// status
program
  .command('status')
  .description('Show compact header and full task detail for the active task')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--quiet', 'Suppress the compact Context Header', false)
  .action(async (opts: { task?: string; quiet: boolean }) => {
    try {
      await runStatus(process.cwd(), opts.task, opts.quiet);
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

// desync-check
program
  .command('desync-check')
  .description('Check task state against the current git workspace')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .action(async (opts: { task?: string }) => {
    try {
      await runDesyncCheck(process.cwd(), opts.task);
    } catch (err) {
      handleError(err);
    }
  });

// rollback
program
  .command('rollback')
  .description('Preview or perform safe rollback for the active task')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--state-only', 'Restore PlaySpec task state only', false)
  .option('--git-only', 'Preview or confirm Git rollback only', false)
  .option('--confirm', 'Confirm a safe Git rollback execution', false)
  .action(async (opts: {
    task?: string;
    stateOnly?: boolean;
    gitOnly?: boolean;
    confirm?: boolean;
  }) => {
    try {
      await runRollback(process.cwd(), opts);
    } catch (err) {
      handleError(err);
    }
  });

// migrate
program
  .command('migrate')
  .description('Migrate historical markdown documents into structured PlaySpec state')
  .option('--mode <mode>', 'Migration mode: review (default), dry-run, auto', 'review')
  .option('--source <path>', 'Source directory or file to scan for markdown documents')
  .option('--task <id>', 'Target task ID (defaults to HEAD)')
  .option('--plan <file>', 'External migration plan file (YAML) to load instead of auto-generating')
  .option('--target-total-spec <file>', 'Specific total spec file to add as a context reference')
  .option('--target-phase-plan <file>', 'Specific phase plan file to add as a context reference')
  .option('--with-archive', 'Enable archive_file actions', false)
  .action(async (opts: {
    mode: string;
    source?: string;
    task?: string;
    plan?: string;
    targetTotalSpec?: string;
    targetPhasePlan?: string;
    withArchive: boolean;
  }) => {
    try {
      const mode = opts.mode as 'review' | 'dry-run' | 'auto';
      if (mode !== 'review' && mode !== 'dry-run' && mode !== 'auto') {
        console.error(chalk.red(`Error: --mode must be one of: review, dry-run, auto`));
        process.exit(1);
      }
      await runMigrate(process.cwd(), {
        mode,
        source: opts.source,
        task: opts.task,
        plan: opts.plan,
        targetTotalSpec: opts.targetTotalSpec,
        targetPhasePlan: opts.targetPhasePlan,
        withArchive: opts.withArchive,
      });
    } catch (err) {
      handleError(err);
    }
  });

program.parse(process.argv);
