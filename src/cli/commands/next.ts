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
import { resolveOutputFilePath } from '../cli-utils.js';
import { renderPromptWithContext, writeFallbackPrompt } from './prompt.js';
import { normalizePromptContextMode, writePromptArtifactMetadata } from '#core/prompt-metadata.js';

export async function runNext(
  workspaceRoot: string,
  taskIdOption?: string,
  write?: boolean,
  quiet?: boolean,
  copy?: boolean,
  outFile?: string,
  withEvolutionContext?: boolean,
  contextModeOption?: string,
): Promise<void> {
  process.stderr.write('Warning: `playspec next` is deprecated. Use `playspec prompt` instead.\n');

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
  const contextMode = normalizePromptContextMode(contextModeOption);
  const desync = await core.checkTaskDesync(task.id);
  if (desync.severity === 'high') {
    console.log('High desync warning: workspace reality differs from the last safe point.');
    printDesyncResult(desync);
    console.log('');
  }

  const prompt = await core.renderNextPrompt(task.id, {
    withEvolutionContext,
    evolutionContextSource: 'next',
    contextMode,
  });
  const { phaseLine, display, shouldPrintStepMetadata, gateRouteLines, nextRouteLines } =
    await renderPromptWithContext(workspaceRoot, task, { renderNextPrompt: async () => prompt });

  // Preserve old statusOnly semantics: body suppressed when --copy or --out
  const statusOnly = copy === true || outFile !== undefined;
  let wroteOutputPath: string | undefined;

  if (outFile) {
    wroteOutputPath = await resolveOutputFilePath(workspaceRoot, outFile);
    await writeTextFile(wroteOutputPath, prompt);
    await writePromptArtifactMetadata({
      workspaceRoot,
      task,
      promptArtifactPath: wroteOutputPath,
      contextMode,
      generationSource: 'next',
      phaseId: display.id,
    });
  }

  console.log(phaseLine);

  if (copy) {
    const result = await copyToClipboard(prompt);
    if (result.ok) {
      for (const line of formatPromptCopySuccess(result)) console.log(line);
      if (wroteOutputPath) {
        console.log(`Prompt written: ${path.relative(workspaceRoot, wroteOutputPath)}`);
      }
    } else {
      if (!wroteOutputPath) {
        wroteOutputPath = await writeFallbackPrompt(workspaceRoot, task, prompt, contextMode, 'next', display.id);
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
        for (const line of gateRouteLines) console.log(line);
      }
      if (nextRouteLines.length > 0) {
        console.log('Next:');
        for (const line of nextRouteLines) console.log(line);
      }
    }
    console.log('');
    console.log(prompt);
  }

  if (write) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const promptPath = path.join(getTaskRoot(workspaceRoot, task.id), 'prompts', `${timestamp}.md`);
    await writeTextFile(promptPath, prompt);
    await writePromptArtifactMetadata({
      workspaceRoot,
      task,
      promptArtifactPath: promptPath,
      contextMode,
      generationSource: 'next',
      phaseId: display.id,
    });
    if (statusOnly) {
      console.log(`Prompt snapshot written: ${path.relative(workspaceRoot, promptPath)}`);
    }
  }
}
