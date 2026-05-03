#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import chalk from 'chalk';
import { PlaySpecError } from '#core/errors.js';
import { runInit } from './commands/init.js';
import { runCreate, runInteractiveCreate } from './commands/create.js';
import { runList } from './commands/list.js';
import { runListTasks } from './commands/list-tasks.js';
import { runCurrent } from './commands/current.js';
import { runCurrentTask } from './commands/current-task.js';
import { runGetTask } from './commands/get-task.js';
import { runAddContext } from './commands/add-context.js';
import { runUse } from './commands/use.js';
import { runNext } from './commands/next.js';
import { runPrompt } from './commands/prompt.js';
import { runSpecs } from './commands/specs.js';
import { runPhase } from './commands/phase.js';
import { runRewind } from './commands/rewind.js';
import { runComplete } from './commands/complete.js';
import { runEvidence } from './commands/evidence.js';
import { runSnapshot } from './commands/snapshot.js';
import { runDesyncCheck } from './commands/desync-check.js';
import { runRollback } from './commands/rollback.js';
import { runStatus } from './commands/status.js';
import { runMigrate } from './commands/migrate.js';
import { runClose } from './commands/close.js';
import { runArchiveList, runArchiveShow } from './commands/archive.js';
import {
  runEvolutionAppendEvidence,
  runEvolutionApply,
  runEvolutionDiff,
  runEvolutionList,
  runEvolutionPropose,
  runEvolutionShow,
  runEvolutionSkip,
  runEvolutionUpdate,
} from './commands/evolution.js';
import {
  runWorkflowExport,
  runWorkflowInstall,
  runWorkflowList,
  runWorkflowRemove,
  runWorkflowShow,
  runWorkflowValidate,
} from './commands/workflow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Read version from package.json
const pkg = require('../../package.json') as { version: string };

function installPipeHandlers(): void {
  const handlePipeError = (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') {
      process.exit(0);
    }
    throw error;
  };
  process.stdout.on('error', handlePipeError);
  process.stderr.on('error', handlePipeError);
}

installPipeHandlers();

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

const workflowCommand = program
  .command('workflow')
  .description('Manage workflow runtime assets');

workflowCommand
  .command('list')
  .description('List available workflows')
  .action(async () => {
    try {
      await runWorkflowList(process.cwd());
    } catch (err) {
      handleError(err);
    }
  });

workflowCommand
  .command('show <id>')
  .description('Show workflow details')
  .action(async (id: string) => {
    try {
      await runWorkflowShow(process.cwd(), id);
    } catch (err) {
      handleError(err);
    }
  });

workflowCommand
  .command('validate <path>')
  .description('Validate a workflow directory')
  .action(async (workflowPath: string) => {
    try {
      await runWorkflowValidate(process.cwd(), workflowPath);
    } catch (err) {
      handleError(err);
    }
  });

workflowCommand
  .command('install <path>')
  .description('Install a user workflow directory')
  .action(async (workflowPath: string) => {
    try {
      await runWorkflowInstall(process.cwd(), workflowPath);
    } catch (err) {
      handleError(err);
    }
  });

workflowCommand
  .command('remove <id>')
  .description('Remove a user workflow')
  .action(async (id: string) => {
    try {
      await runWorkflowRemove(process.cwd(), id);
    } catch (err) {
      handleError(err);
    }
  });

workflowCommand
  .command('export <id> [outDir]')
  .description('Export a workflow directory')
  .action(async (id: string, outDir: string | undefined) => {
    try {
      await runWorkflowExport(process.cwd(), id, outDir);
    } catch (err) {
      handleError(err);
    }
  });

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
  .command('create [first] [second]')
  .description('Create a new task (omit both arguments to launch the interactive wizard)')
  .option('--workflow <id>', 'Workflow to use', 'mono-spec')
  .option('--phase <n>', 'Target workflow phase for phase-execution tasks')
  .option('--from <value>', 'Source problem file path (without --phase) or planning task ID (with --phase)')
  .option('--from-file <path>', 'Seed the task from a source problem file')
  .option('--stdin', 'Seed the task from stdin (for scripts and automation)', false)
  .option('--edit', 'Open $EDITOR to write the source problem', false)
  .action(async (first: string | undefined, second: string | undefined, opts: { workflow: string; phase?: string; from?: string; fromFile?: string; stdin?: boolean; edit?: boolean }) => {
    if (!first && !second) {
      const isInteractive = process.stdout.isTTY === true && !process.env['PLAY_SPEC_NON_INTERACTIVE'];
      if (!isInteractive) {
        console.error(chalk.red('Error: Interactive wizard requires a terminal.'));
        console.error(chalk.yellow('Hint: Use: playspec create "<title>" --workflow mono-spec'));
        process.exit(1);
      }
      try {
        await runInteractiveCreate(process.cwd());
      } catch (err) {
        handleError(err);
      }
      return;
    }
    const workflow = second ? first : opts.workflow;
    const title = second ?? first;
    if (!workflow || !title) {
      console.error(chalk.red('Error: Task title is required, or omit all arguments for the interactive wizard.'));
      process.exit(1);
    }
    try {
      await runCreate(process.cwd(), workflow, title, opts);
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

// list-tasks
program
  .command('list-tasks')
  .description('List active tasks with workflow and phase state')
  .action(async () => {
    try {
      await runListTasks(process.cwd());
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

// current-task
program
  .command('current-task')
  .description('Show the current HEAD task with resolved phase title and context ref count')
  .action(async () => {
    try {
      await runCurrentTask(process.cwd());
    } catch (err) {
      handleError(err);
    }
  });

// get-task
program
  .command('get-task')
  .description('Look up a specific task by ID (no HEAD fallback)')
  .requiredOption('--task <id>', 'Task ID to look up')
  .option('--json', 'Emit task record as JSON', false)
  .action(async (opts: { task: string; json: boolean }) => {
    try {
      await runGetTask(process.cwd(), opts.task, opts.json);
    } catch (err) {
      handleError(err);
    }
  });

// add-context
program
  .command('add-context [file]')
  .description('Add a context file reference to a task')
  .option('--task <id>', 'Task ID to add context to')
  .option('--edit', 'Open $EDITOR to write a context note for the task', false)
  .action(async (file: string | undefined, opts: { task?: string; edit: boolean }) => {
    try {
      await runAddContext(process.cwd(), file, opts.task, opts.edit);
    } catch (err) {
      handleError(err);
    }
  });

// use
program
  .command('use [taskId]')
  .description('Set the active task by ID')
  .action(async (taskId: string | undefined) => {
    try {
      await runUse(process.cwd(), taskId);
    } catch (err) {
      handleError(err);
    }
  });

// prompt (canonical command)
program
  .command('prompt')
  .description('Render the next phase prompt (copies to clipboard by default)')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--no-copy', 'Render without copying to clipboard (prints prompt body instead)')
  .option('--print-only', 'Print raw prompt body to stdout without copying', false)
  .option('--quiet', 'Suppress the compact Context Header', false)
  .option('--write', 'Write prompt snapshot to prompts/ directory', false)
  .option('--out <file>', 'Write prompt to a user-selected output file')
  .action(async (opts: { task?: string; copy: boolean; printOnly: boolean; quiet: boolean; write: boolean; out?: string }) => {
    try {
      await runPrompt(process.cwd(), opts.task, !opts.copy, opts.printOnly, opts.quiet, opts.write, opts.out);
    } catch (err) {
      handleError(err);
    }
  });

// specs
program
  .command('specs')
  .description('Find relevant files for the current task and effective phase')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--print', 'Print selected file content interactively, or all existing file contents non-interactively', false)
  .option('--path-only', 'Print existing relevant file paths only', false)
  .option('--no-copy', 'Select without copying to clipboard')
  .option('--show-missing', 'Show missing expected files on stderr', false)
  .option('--force-large', 'Allow printing or copying files larger than 1 MiB', false)
  .action(async (opts: { task?: string; print: boolean; pathOnly: boolean; copy: boolean; showMissing: boolean; forceLarge: boolean }) => {
    try {
      await runSpecs(process.cwd(), opts);
    } catch (err) {
      handleError(err);
    }
  });

// next (deprecated alias for prompt)
program
  .command('next')
  .description('[deprecated] Use `prompt` instead')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--write', 'Write prompt to prompts/ directory', false)
  .option('--quiet', 'Suppress the compact Context Header', false)
  .option('--copy', 'Copy rendered prompt to clipboard', false)
  .option('--out <file>', 'Write prompt to a user-selected output file')
  .action(async (opts: { task?: string; write: boolean; quiet: boolean; copy: boolean; out?: string }) => {
    try {
      await runNext(process.cwd(), opts.task, opts.write, opts.quiet, opts.copy, opts.out);
    } catch (err) {
      handleError(err);
    }
  });

// phase
program
  .command('phase [phaseId]')
  .description('Render a specific phase prompt, or set/select the current phase for recovery')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--set <phaseId>', 'Set current phase to the specified phase ID (recovery)')
  .option('--select', 'Select current phase from an interactive list (recovery)', false)
  .option('--yes', 'Confirm mutation without interactive prompt', false)
  .action(async (phaseId: string | undefined, opts: { task?: string; set?: string; select: boolean; yes: boolean }) => {
    try {
      await runPhase(process.cwd(), phaseId, opts);
    } catch (err) {
      handleError(err);
    }
  });

// rewind
program
  .command('rewind')
  .description('Move the current phase pointer backward in the workflow (recovery)')
  .option('--steps <n>', 'Number of phases to rewind (default: 1 in interactive mode)')
  .option('--task <id>', 'Task ID (defaults to HEAD)')
  .option('--yes', 'Confirm mutation without interactive prompt', false)
  .action(async (opts: { steps?: string; task?: string; yes: boolean }) => {
    try {
      await runRewind(process.cwd(), opts);
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
  .option('--no-copy', 'Do not copy the next prompt to clipboard after completion')
  .action(async (opts: { task?: string; withReview: boolean; quiet: boolean; result?: string; copy: boolean }) => {
    try {
      await runComplete(process.cwd(), opts.task, opts.withReview, opts.quiet, opts.result, !opts.copy);
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

// close
program
  .command('close')
  .description('Close a completed task into archive storage')
  .requiredOption('--task <id>', 'Completed task ID to close')
  .action(async (opts: { task: string }) => {
    try {
      await runClose(process.cwd(), opts.task);
    } catch (err) {
      handleError(err);
    }
  });

// archive
const archiveCommand = program
  .command('archive')
  .description('Inspect archived tasks');

archiveCommand
  .command('list')
  .description('List archived tasks')
  .action(async () => {
    try {
      await runArchiveList(process.cwd());
    } catch (err) {
      handleError(err);
    }
  });

archiveCommand
  .command('show')
  .description('Show an archived task')
  .requiredOption('--task <id>', 'Archived task ID to show')
  .action(async (opts: { task: string }) => {
    try {
      await runArchiveShow(process.cwd(), opts.task);
    } catch (err) {
      handleError(err);
    }
  });

// evolution
const evolutionCommand = program
  .command('evolution')
  .description('Inspect and manage evolution proposals');

evolutionCommand
  .command('propose')
  .description('Validate and store an evolution proposal file')
  .requiredOption('--file <proposal.yaml>', 'Proposal YAML file to validate and store')
  .action(async (opts: { file: string }) => {
    try {
      await runEvolutionPropose(process.cwd(), opts.file);
    } catch (err) {
      handleError(err);
    }
  });

evolutionCommand
  .command('list')
  .description('List stored evolution proposals')
  .action(async () => {
    try {
      await runEvolutionList(process.cwd());
    } catch (err) {
      handleError(err);
    }
  });

evolutionCommand
  .command('show <proposalId>')
  .description('Show a stored evolution proposal')
  .action(async (proposalId: string) => {
    try {
      await runEvolutionShow(process.cwd(), proposalId);
    } catch (err) {
      handleError(err);
    }
  });

evolutionCommand
  .command('diff <proposalId>')
  .description('Preview executable evolution proposal changes')
  .action(async (proposalId: string) => {
    try {
      await runEvolutionDiff(process.cwd(), proposalId);
    } catch (err) {
      handleError(err);
    }
  });

evolutionCommand
  .command('apply <proposalId>')
  .description('Apply an approved executable evolution proposal')
  .option('--yes', 'Explicitly approve mutation after reviewing diff', false)
  .action(async (proposalId: string, opts: { yes: boolean }) => {
    try {
      await runEvolutionApply(process.cwd(), proposalId, opts);
    } catch (err) {
      handleError(err);
    }
  });

evolutionCommand
  .command('update <proposalId>')
  .description('Update an existing pending/refining evolution proposal')
  .requiredOption('--file <proposal.yaml>', 'Proposal YAML file to merge into the existing proposal')
  .action(async (proposalId: string, opts: { file: string }) => {
    try {
      await runEvolutionUpdate(process.cwd(), proposalId, opts.file);
    } catch (err) {
      handleError(err);
    }
  });

evolutionCommand
  .command('append-evidence <proposalId>')
  .description('Append evidence to an existing pending/refining evolution proposal')
  .requiredOption('--file <path>', 'Workspace-relative evidence file path')
  .requiredOption('--note <text>', 'Evidence note')
  .action(async (proposalId: string, opts: { file: string; note: string }) => {
    try {
      await runEvolutionAppendEvidence(process.cwd(), proposalId, opts.file, opts.note);
    } catch (err) {
      handleError(err);
    }
  });

evolutionCommand
  .command('skip <proposalId>')
  .description('Mark an evolution proposal skipped')
  .option('--reason <text>', 'Reason the proposal is being skipped')
  .action(async (proposalId: string, opts: { reason?: string }) => {
    try {
      await runEvolutionSkip(process.cwd(), proposalId, opts.reason);
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
