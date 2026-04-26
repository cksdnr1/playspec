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
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { formatGateRoutes, gateResults, phaseDisplayInfo } from '#workflow/phase-display.js';
import { resolveOutputFilePath } from '../cli-utils.js';

export async function runNext(
  workspaceRoot: string,
  taskIdOption?: string,
  write?: boolean,
  quiet?: boolean,
  copy?: boolean,
  outFile?: string
): Promise<void> {
  const store = new YamlTaskStore(workspaceRoot);
  const resolver = new ActiveTaskResolver(workspaceRoot, store);
  const task = await resolver.resolveTask(taskIdOption);
  if (!taskIdOption && task.status !== 'active') {
    throw new TaskNotActiveError(task.id, task.status);
  }

  if (!quiet) {
    console.log(formatContextHeader(task).join('\n'));
    console.log('');
  }

  const core = new PlaySpecCore(workspaceRoot, store);
  const desync = await core.checkTaskDesync(task.id);
  if (desync.severity === 'high') {
    console.log('High desync warning: workspace reality differs from the last safe point.');
    printDesyncResult(desync);
    console.log('');
  }

  const prompt = await core.renderNextPrompt(task.id);
  const workflowLoader = new WorkflowLoader(workspaceRoot);
  const phaseResolver = new PhaseResolver();
  const workflow = await workflowLoader.load(task.workflowType);
  const { phaseId, definition } = phaseResolver.resolveCurrentPhase(task, workflow);
  const display = phaseDisplayInfo(phaseId, definition);
  const gateRouteLines = definition.stepNumber && gateResults(definition).length > 0
    ? formatGateRoutes(workflow, definition)
    : [];
  const shouldPrintStepMetadata = definition.stepNumber !== undefined;
  const phaseLine = `Resolved phase: ${display.label}${definition.stepNumber ? ` (id: ${display.id})` : ''}`;
  const statusOnly = copy === true || outFile !== undefined;
  let wroteOutputPath: string | undefined;

  if (outFile) {
    wroteOutputPath = await resolveOutputFilePath(workspaceRoot, outFile);
    await writeTextFile(wroteOutputPath, prompt);
  }

  console.log(phaseLine);

  if (copy) {
    const result = await copyToClipboard(prompt);
    if (result.ok) {
      console.log(`Prompt copied to clipboard${result.method ? ` via ${result.method}` : ''}.`);
      if (wroteOutputPath) {
        console.log(`Prompt written: ${path.relative(workspaceRoot, wroteOutputPath)}`);
      }
    } else {
      if (!wroteOutputPath) {
        wroteOutputPath = await writeFallbackPrompt(workspaceRoot, task.id, prompt);
      }
      const fallbackRelPath = path.relative(workspaceRoot, wroteOutputPath);
      if (result.attempted) {
        console.log(`Prompt copy attempted via OSC52. Fallback written to: ${fallbackRelPath}`);
      } else {
        console.log(`Clipboard unavailable. Prompt written to: ${fallbackRelPath}`);
      }
    }
  }

  if (wroteOutputPath && !copy) {
    console.log(`Prompt written: ${path.relative(workspaceRoot, wroteOutputPath)}`);
  }

  if (!statusOnly) {
    if (shouldPrintStepMetadata) {
      console.log(`Current step: ${display.label}`);
      console.log(`id: ${display.id}`);
      if (gateRouteLines.length > 0) {
        console.log('Gate:');
        for (const line of gateRouteLines) {
          console.log(line);
        }
      }
    }
    console.log('');
    console.log(prompt);
  } else {
    void quiet;
  }

  if (write) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const promptPath = path.join(
      getTaskRoot(workspaceRoot, task.id),
      'prompts',
      `${timestamp}.md`
    );
    await writeTextFile(promptPath, prompt);
    if (statusOnly) {
      console.log(`Prompt snapshot written: ${path.relative(workspaceRoot, promptPath)}`);
    }
  }
}

async function writeFallbackPrompt(
  workspaceRoot: string,
  taskId: string,
  prompt: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const promptPath = path.join(
    getTaskRoot(workspaceRoot, taskId),
    'prompts',
    `next-prompt-${timestamp}.md`
  );
  await writeTextFile(promptPath, prompt);
  return promptPath;
}
