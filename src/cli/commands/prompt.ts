import path from 'node:path';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { ActiveTaskResolver } from '#core/active-task-resolver.js';
import { PlaySpecCore } from '#core/playspec-core.js';
import { TaskNotActiveError } from '#core/errors.js';
import { printDesyncResult } from './desync-check.js';
import { writeTextFile } from '#utils/fs.js';
import { getTaskRoot } from '#utils/paths.js';
import { formatContextHeader } from '../context-header.js';
import { copyToClipboard } from '#utils/clipboard.js';
import { formatPromptCopySuccess } from '#utils/clipboard-message.js';
import {
  DEFAULT_PROMPT_CONTEXT_MODE,
  normalizePromptContextMode,
  writePromptArtifactMetadata,
} from '#core/prompt-metadata.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { formatGateRoutes, formatNextRoute, gateResults, phaseDisplayInfo } from '#workflow/phase-display.js';
import { resolveOutputFilePath } from '../cli-utils.js';
import type { PromptContextMode, PromptGenerationSource, TaskRecord } from '#core/types.js';

export interface PromptRenderResult {
  prompt: string;
  phaseLine: string;
  display: { label: string; id: string };
  shouldPrintStepMetadata: boolean;
  gateRouteLines: string[];
  nextRouteLines: string[];
}

export async function renderPromptWithContext(
  workspaceRoot: string,
  task: TaskRecord,
  core: { renderNextPrompt: (id: string) => Promise<string> },
): Promise<PromptRenderResult> {
  const prompt = await core.renderNextPrompt(task.id);
  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const phaseResolver = new PhaseResolver();
  const workflow = await workflowLoader.load(task.workflow);
  const { phaseId, definition } = phaseResolver.resolveCurrentPhase(task, workflow);
  const display = phaseDisplayInfo(phaseId, definition);
  const gateRouteLines = definition.stepNumber && gateResults(definition).length > 0
    ? formatGateRoutes(workflow, definition) : [];
  const nextRouteLines = definition.stepNumber && gateResults(definition).length === 0 && definition.next !== undefined
    ? formatNextRoute(workflow, definition) : [];
  const phaseLine = `Resolved phase: ${display.label}${definition.stepNumber ? ` (id: ${display.id})` : ''}`;
  return { prompt, phaseLine, display, shouldPrintStepMetadata: definition.stepNumber !== undefined, gateRouteLines, nextRouteLines };
}

export interface PromptOutputOptions {
  noCopy?: boolean;
  printOnly?: boolean;
  quiet?: boolean;
  write?: boolean;
  outFile?: string;
  contextMode?: PromptContextMode;
  generationSource?: PromptGenerationSource;
}

// Shared helper used by both `prompt` and post-completion rendering in `complete`.
export async function outputPrompt(
  workspaceRoot: string,
  task: TaskRecord,
  prompt: string,
  opts: PromptOutputOptions,
): Promise<void> {
  const {
    noCopy = false,
    printOnly = false,
    write = false,
    outFile,
    contextMode = DEFAULT_PROMPT_CONTEXT_MODE,
    generationSource = 'prompt',
  } = opts;

  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const phaseResolver = new PhaseResolver();
  const workflow = await workflowLoader.load(task.workflow);
  const { phaseId, definition } = phaseResolver.resolveCurrentPhase(task, workflow);
  const display = phaseDisplayInfo(phaseId, definition);
  const gateRouteLines = definition.stepNumber && gateResults(definition).length > 0
    ? formatGateRoutes(workflow, definition) : [];
  const nextRouteLines = definition.stepNumber && gateResults(definition).length === 0 && definition.next !== undefined
    ? formatNextRoute(workflow, definition) : [];
  const shouldPrintStepMetadata = definition.stepNumber !== undefined;
  const phaseLine = `Resolved phase: ${display.label}${definition.stepNumber ? ` (id: ${display.id})` : ''}`;

  let wroteOutputPath: string | undefined;
  if (outFile) {
    wroteOutputPath = await resolveOutputFilePath(workspaceRoot, outFile);
    await writeTextFile(wroteOutputPath, prompt);
    await writePromptArtifactMetadata({
      workspaceRoot,
      task,
      promptArtifactPath: wroteOutputPath,
      contextMode,
      generationSource,
      phaseId,
    });
  }

  if (printOnly) {
    console.log(prompt);
    if (wroteOutputPath) {
      process.stderr.write(`Prompt written: ${path.relative(workspaceRoot, wroteOutputPath)}\n`);
    }
    if (write) {
      await writePromptSnapshot(workspaceRoot, task, prompt, contextMode, generationSource, phaseId);
    }
    return;
  }

  console.log(phaseLine);

  if (noCopy) {
    if (wroteOutputPath) {
      console.log(`Prompt written: ${path.relative(workspaceRoot, wroteOutputPath)}`);
    }
    if (shouldPrintStepMetadata) {
      console.log(`Current step: ${display.label}`);
      console.log(`id: ${display.id}`);
      if (gateRouteLines.length > 0) {
        console.log('Gate:');
        for (const line of gateRouteLines) console.log(line);
      }
      if (nextRouteLines.length > 0) {
        console.log('Next:');
        for (const line of nextRouteLines) console.log(line);
      }
    }
    console.log('');
    console.log(prompt);
  } else {
    // Default: copy to clipboard
    const result = await copyToClipboard(prompt);
    if (result.ok) {
      for (const line of formatPromptCopySuccess(result)) console.log(line);
      if (wroteOutputPath) {
        console.log(`Prompt written: ${path.relative(workspaceRoot, wroteOutputPath)}`);
      }
    } else {
      if (!wroteOutputPath) {
        wroteOutputPath = await writeFallbackPrompt(workspaceRoot, task, prompt, contextMode, generationSource, phaseId);
      }
      const fallbackRelPath = path.relative(workspaceRoot, wroteOutputPath);
      if (result.attempted) {
        console.log(`Prompt copy attempted via OSC52. Fallback written to: ${fallbackRelPath}`);
      } else {
        console.log(`Clipboard unavailable. Prompt written to: ${fallbackRelPath}`);
      }
    }
  }

  if (write) {
    const snapshotPath = await writePromptSnapshot(workspaceRoot, task, prompt, contextMode, generationSource, phaseId);
    if (noCopy) {
      console.log(`Prompt snapshot written: ${path.relative(workspaceRoot, snapshotPath)}`);
    }
  }
}

async function writePromptSnapshot(
  workspaceRoot: string,
  task: TaskRecord,
  prompt: string,
  contextMode: PromptContextMode,
  generationSource: PromptGenerationSource,
  phaseId: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const promptPath = path.join(getTaskRoot(workspaceRoot, task.id), 'prompts', `${timestamp}.md`);
  await writeTextFile(promptPath, prompt);
  await writePromptArtifactMetadata({
    workspaceRoot,
    task,
    promptArtifactPath: promptPath,
    contextMode,
    generationSource,
    phaseId,
  });
  return promptPath;
}

export async function writeFallbackPrompt(
  workspaceRoot: string,
  task: TaskRecord,
  prompt: string,
  contextMode: PromptContextMode,
  generationSource: PromptGenerationSource,
  phaseId: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const promptPath = path.join(getTaskRoot(workspaceRoot, task.id), 'prompts', `next-prompt-${timestamp}.md`);
  await writeTextFile(promptPath, prompt);
  await writePromptArtifactMetadata({
    workspaceRoot,
    task,
    promptArtifactPath: promptPath,
    contextMode,
    generationSource,
    phaseId,
  });
  return promptPath;
}

export async function runPrompt(
  workspaceRoot: string,
  taskIdOption?: string,
  noCopy?: boolean,
  printOnly?: boolean,
  quiet?: boolean,
  write?: boolean,
  outFile?: string,
  withEvolutionContext?: boolean,
  contextModeOption?: string,
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);
  if (task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
  }

  if (!quiet) {
    console.log(formatContextHeader(task).join('\n'));
    console.log('');
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const contextMode = normalizePromptContextMode(contextModeOption);
  const desync = await core.checkTaskDesync(task.id);
  if (desync.severity === 'high') {
    console.log('High desync warning: workspace reality differs from the last safe point.');
    printDesyncResult(desync);
    console.log('');
  }

  const prompt = await core.renderNextPrompt(task.id, {
    withEvolutionContext,
    evolutionContextSource: 'prompt',
    contextMode,
  });
  await outputPrompt(workspaceRoot, task, prompt, {
    noCopy,
    printOnly,
    quiet,
    write,
    outFile,
    contextMode,
    generationSource: 'prompt',
  });
}
