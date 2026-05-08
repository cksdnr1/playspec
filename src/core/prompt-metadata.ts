import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { PromptArtifactMetadataSchema } from '#core/schemas.js';
import type {
  OmittedPromptContext,
  PromptArtifactMetadata,
  PromptContextMode,
  PromptGenerationSource,
  TaskRecord,
} from '#core/types.js';
import { writeTextFileAtomic } from '#utils/fs.js';

export const DEFAULT_PROMPT_CONTEXT_MODE: PromptContextMode = 'compact';

export function normalizePromptContextMode(mode?: string): PromptContextMode {
  if (mode === undefined || mode === '') {
    return DEFAULT_PROMPT_CONTEXT_MODE;
  }
  if (mode === 'compact' || mode === 'strict' || mode === 'full') {
    return mode;
  }
  throw new Error(`Invalid context mode "${mode}". Expected compact, strict, or full.`);
}

export function getOmittedPromptContext(
  task: TaskRecord,
  contextMode: PromptContextMode
): OmittedPromptContext[] {
  if (contextMode !== 'compact') {
    return [];
  }
  return (task.contextRefs ?? []).map((ref) => ({
    path: ref.path,
    role: ref.role,
    source: ref.source,
    reason: 'full context file body omitted by compact context mode',
  }));
}

export async function writePromptArtifactMetadata(input: {
  workspaceRoot: string;
  task: TaskRecord;
  promptArtifactPath: string;
  contextMode?: PromptContextMode;
  generationSource: PromptGenerationSource;
  phaseId?: string;
  generatedAt?: string;
}): Promise<string> {
  const metadata: PromptArtifactMetadata = {
    promptArtifactPath: path.relative(input.workspaceRoot, input.promptArtifactPath),
    contextMode: input.contextMode ?? DEFAULT_PROMPT_CONTEXT_MODE,
    generationSource: input.generationSource,
    taskId: input.task.id,
    ...(input.phaseId ? { phaseId: input.phaseId } : {}),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    omittedContext: getOmittedPromptContext(
      input.task,
      input.contextMode ?? DEFAULT_PROMPT_CONTEXT_MODE
    ),
  };

  const validated = PromptArtifactMetadataSchema.parse(metadata);
  const metadataPath = `${input.promptArtifactPath}.meta.yaml`;
  await writeTextFileAtomic(metadataPath, stringifyYaml(validated));
  return metadataPath;
}
