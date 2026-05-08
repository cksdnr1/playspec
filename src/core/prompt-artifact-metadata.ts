import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { PromptArtifactMetadataSchema } from '#core/schemas.js';
import type {
  PromptArtifactMetadata,
  PromptContextMode,
  PromptOmittedContextEntry,
  TaskRecord,
} from '#core/types.js';
import { writeTextFileAtomic } from '#utils/fs.js';

export interface WritePromptArtifactMetadataInput {
  workspaceRoot: string;
  promptPath: string;
  task: TaskRecord;
  phaseId?: string;
  contextMode: PromptContextMode;
  generationSource: PromptArtifactMetadata['generationSource'];
  generatedAt?: string;
}

export async function writePromptArtifactMetadata(
  input: WritePromptArtifactMetadataInput
): Promise<string> {
  const metadata = buildPromptArtifactMetadata(input);
  const sidecarPath = `${input.promptPath}.meta.yaml`;
  await writeTextFileAtomic(sidecarPath, stringifyYaml(PromptArtifactMetadataSchema.parse(metadata)));
  return sidecarPath;
}

export function buildPromptArtifactMetadata(
  input: WritePromptArtifactMetadataInput
): PromptArtifactMetadata {
  return PromptArtifactMetadataSchema.parse({
    promptArtifactPath: path.relative(input.workspaceRoot, input.promptPath),
    contextMode: input.contextMode,
    generationSource: input.generationSource,
    taskId: input.task.id,
    phaseId: input.phaseId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    omittedContext: buildOmittedContext(input.task, input.contextMode),
  });
}

function buildOmittedContext(
  task: TaskRecord,
  contextMode: PromptContextMode
): PromptOmittedContextEntry[] {
  if (contextMode !== 'compact') {
    return [];
  }
  return (task.contextRefs ?? []).map((ref) => ({
    path: ref.path,
    role: ref.role,
    source: ref.source,
    reason: 'body omitted in compact context mode',
  }));
}
