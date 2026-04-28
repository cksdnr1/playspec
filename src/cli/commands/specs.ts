import { readFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { TextDecoder } from 'node:util';
import { PlaySpecError, TaskNotActiveError } from '#core/errors.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { discoverRelevantFiles } from '#core/relevant-files.js';
import type { RelevantFileCandidate } from '#core/relevant-files.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { copyToClipboard } from '#utils/clipboard.js';
import { isInteractiveCli } from '../cli-utils.js';

const LARGE_FILE_BYTES = 1024 * 1024;

export interface SpecsOptions {
  task?: string;
  print?: boolean;
  pathOnly?: boolean;
  copy?: boolean;
  showMissing?: boolean;
  forceLarge?: boolean;
}

interface SelectorItem {
  candidate: RelevantFileCandidate;
  label: string;
}

export async function runSpecs(workspaceRoot: string, opts: SpecsOptions): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(opts.task);
  if (!opts.task && task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
  }

  const workflow = await new WorkflowLoader(workspaceRoot).load(task.workflowType);
  const { phaseId, definition } = new PhaseResolver().resolveCurrentPhase(task, workflow);
  const discovery = await discoverRelevantFiles({ workspaceRoot, task, workflow, phaseId, definition });

  for (const warning of discovery.warnings) {
    process.stderr.write(`Warning: ${warning.path ? `${warning.path}: ` : ''}${warning.message}\n`);
  }

  const existing = discovery.candidates.filter((candidate) => candidate.exists);
  const missing = discovery.candidates.filter((candidate) => !candidate.exists);
  if (opts.showMissing && missing.length > 0) {
    process.stderr.write('Missing expected files:\n');
    for (const candidate of missing) {
      process.stderr.write(`- ${candidate.path}\n`);
    }
  }

  if (existing.length === 0) {
    throw new PlaySpecError(
      'No existing relevant files found.',
      missing.length > 0 ? 'Run `playspec specs --show-missing` to inspect expected missing files.' : 'Add task context or docs, then rerun `playspec specs`.'
    );
  }

  if (opts.pathOnly) {
    for (const candidate of existing) {
      console.log(candidate.path);
    }
    return;
  }

  const interactive = isInteractiveCli();
  if (!interactive && !opts.print) {
    throw new PlaySpecError(
      'Non-interactive specs requires an output mode.',
      'Use `playspec specs --path-only` or `playspec specs --print`.'
    );
  }

  if (opts.print && !interactive) {
    await printAllCandidates(existing, opts.forceLarge === true);
    return;
  }

  const selected = await selectFile(existing);
  if (opts.print) {
    const content = await readCandidateText(selected, { forceLarge: opts.forceLarge === true, interactive: true, action: 'print' });
    console.log(content);
    return;
  }

  if (opts.copy === false) {
    console.log(`Selected file: ${selected.path}`);
    return;
  }

  const content = await readCandidateText(selected, { forceLarge: opts.forceLarge === true, interactive: true, action: 'copy' });
  const result = await copyToClipboard(content);
  if (result.ok) {
    console.log(`Copied ${selected.path} to clipboard${result.method ? ` via ${result.method}` : ''}.`);
    if (result.primaryOk === false) {
      process.stderr.write('Warning: PRIMARY selection copy failed; CLIPBOARD copy succeeded.\n');
    }
    return;
  }

  throw new PlaySpecError(
    `Clipboard copy failed${result.error ? `: ${result.error}` : '.'}`,
    'Rerun with `playspec specs --print` or `playspec specs --no-copy`.'
  );
}

async function printAllCandidates(candidates: RelevantFileCandidate[], forceLarge: boolean): Promise<void> {
  let printedAny = false;
  for (const candidate of candidates) {
    try {
      const content = await readCandidateText(candidate, { forceLarge, interactive: false, action: 'print' });
      console.log(`===== ${candidate.path} =====`);
      console.log(content);
      printedAny = true;
    } catch (error) {
      if (error instanceof SkippedCandidateError) {
        process.stderr.write(`Warning: ${candidate.path}: ${error.message}\n`);
        continue;
      }
      throw error;
    }
  }

  if (!printedAny) {
    throw new PlaySpecError('No printable relevant files found.');
  }
}

async function readCandidateText(
  candidate: RelevantFileCandidate,
  opts: { forceLarge: boolean; interactive: boolean; action: 'copy' | 'print' }
): Promise<string> {
  const fileStat = await stat(candidate.absolutePath);
  if (fileStat.size > LARGE_FILE_BYTES && !opts.forceLarge) {
    if (!opts.interactive) {
      throw new SkippedCandidateError(`larger than 1 MiB; rerun with --force-large to ${opts.action}`);
    }
    const confirmed = await confirmLargeFile(fileStat.size, opts.action);
    if (!confirmed) {
      throw new PlaySpecError(
        `Large file ${opts.action} cancelled.`,
        'Rerun with `--force-large` to skip this confirmation.'
      );
    }
  }

  const buffer = await readFile(candidate.absolutePath);
  const content = decodeText(buffer);
  if (content === null) {
    if (opts.interactive) {
      throw new PlaySpecError(`Selected file is binary or non-UTF-8: ${candidate.path}`);
    }
    throw new SkippedCandidateError('binary or non-UTF-8 content');
  }
  return content;
}

function decodeText(buffer: Buffer): string | null {
  if (buffer.includes(0)) {
    return null;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

async function confirmLargeFile(size: number, action: 'copy' | 'print'): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`Selected file is ${formatBytes(size)}. ${action === 'copy' ? 'Copy' : 'Print'} anyway? [y/N] `);
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function selectFile(candidates: RelevantFileCandidate[]): Promise<RelevantFileCandidate> {
  const items = candidates.map((candidate) => ({
    candidate,
    label: `${candidate.path}  [${candidate.source}] ${candidate.reason}`,
  }));
  return selectCandidate(items);
}

async function selectCandidate(items: SelectorItem[]): Promise<RelevantFileCandidate> {
  let selectedIndex = 0;
  let renderedLines = 0;
  const stdin = process.stdin;
  const stdout = process.stdout;
  const wasRaw = stdin.isRaw === true;

  return new Promise<RelevantFileCandidate>((resolve, reject) => {
    let isDone = false;

    const restore = () => {
      stdin.off('data', onData);
      if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(wasRaw);
      }
      stdout.write('\x1b[?25h');
      if (!wasRaw) {
        stdin.pause();
      }
    };

    const finish = (result: RelevantFileCandidate) => {
      if (isDone) return;
      isDone = true;
      restore();
      stdout.write('\n');
      resolve(result);
    };

    const cancel = () => {
      if (isDone) return;
      isDone = true;
      restore();
      stdout.write('\n');
      reject(new PlaySpecError('Cancelled. No file selected.'));
    };

    const fail = (error: unknown) => {
      if (isDone) return;
      isDone = true;
      restore();
      stdout.write('\n');
      reject(error);
    };

    const render = () => {
      if (renderedLines > 0) {
        stdout.write(`\x1b[${renderedLines}A`);
        stdout.write('\x1b[J');
      }

      const lines = [
        'Select a relevant file:',
        ...items.map((item, index) => `${index === selectedIndex ? '>' : ' '} ${item.label}`),
        'Use Up/Down to move, Enter to select, Esc or Ctrl+C to cancel.',
      ];
      stdout.write(`${lines.join('\n')}\n`);
      const termWidth = stdout.columns || 80;
      renderedLines = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / termWidth)), 0);
    };

    const onData = (data: Buffer) => {
      try {
        const value = data.toString('utf8');
        let cursor = 0;
        while (cursor < value.length) {
          if (value.startsWith('\u001b[A', cursor)) {
            selectedIndex = selectedIndex === 0 ? items.length - 1 : selectedIndex - 1;
            render();
            cursor += 3;
            continue;
          }
          if (value.startsWith('\u001b[B', cursor)) {
            selectedIndex = selectedIndex === items.length - 1 ? 0 : selectedIndex + 1;
            render();
            cursor += 3;
            continue;
          }

          const char = value[cursor];
          if (char === '\u0003' || char === '\u001b') {
            cancel();
            return;
          }
          if (char === '\r' || char === '\n') {
            finish(items[selectedIndex].candidate);
            return;
          }
          cursor += 1;
        }
      } catch (error) {
        fail(error);
      }
    };

    try {
      stdout.write('\x1b[?25l');
      if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(true);
      }
      stdin.resume();
      stdin.on('data', onData);
      render();
    } catch (error) {
      fail(error);
    }
  });
}

class SkippedCandidateError extends Error {}
