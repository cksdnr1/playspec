import open from 'open';
import path from 'node:path';
import { MarkdownViewer } from '#viewer/markdown-viewer.js';
import type { ViewerArtifactType } from '#viewer/markdown-viewer.js';

export interface ViewOptions {
  task?: string;
  artifact?: string;
  open?: boolean;
  stdout?: boolean;
  clearCache?: boolean;
}

const ARTIFACT_TYPES = new Set<string>([
  'source',
  'spec',
  'plan',
  'result',
  'pr',
  'prompt',
  'evidence',
  'snapshot',
  'review',
]);

export async function runView(
  workspaceRoot: string,
  file: string | undefined,
  options: ViewOptions
): Promise<void> {
  const viewer = new MarkdownViewer(workspaceRoot);

  if (options.clearCache) {
    if (file || options.task || options.artifact || options.open || options.stdout) {
      throw new Error('--clear-cache cannot be combined with file, task, artifact, open, or stdout options.');
    }
    await viewer.clearCache();
    console.log('Viewer cache cleared.');
    return;
  }

  if (file && (options.task || options.artifact)) {
    throw new Error('Use either a file path or --task with --artifact, not both.');
  }
  if ((options.task && !options.artifact) || (!options.task && options.artifact)) {
    throw new Error('Task artifact viewing requires both --task and --artifact.');
  }
  if (options.artifact && !ARTIFACT_TYPES.has(options.artifact)) {
    throw new Error(`Unsupported artifact "${options.artifact}". Expected one of: ${[...ARTIFACT_TYPES].join(', ')}`);
  }

  const result = await viewer.view({
    file,
    taskId: options.task,
    artifact: options.artifact as ViewerArtifactType | undefined,
    stdout: options.stdout,
  });

  if (options.stdout) {
    console.log(result.html);
    return;
  }

  if (!result.outputPath) {
    throw new Error('Viewer did not produce an output path.');
  }

  console.log(`Rendered ${result.sourcePath}`);
  console.log(`Output: ${result.outputPath}`);

  if (options.open) {
    await open(path.resolve(workspaceRoot, result.outputPath));
  }
}
