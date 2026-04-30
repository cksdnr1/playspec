import path from 'node:path';
import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import { VariableResolver } from '#template/variable-resolver.js';
import { TemplateRenderer } from '#template/template-renderer.js';
import type { PhaseDefinition, TaskRecord, WorkflowDefinition } from './types.js';

export type RelevantFileSource =
  | 'context-ref'
  | 'task-source'
  | 'variable'
  | 'workflow'
  | 'rendered-prompt'
  | 'project-doc-root';

export interface RelevantFileCandidate {
  path: string;
  absolutePath: string;
  exists: boolean;
  source: RelevantFileSource;
  reason: string;
  variableName?: string;
}

export interface RelevantFileWarning {
  path?: string;
  message: string;
}

export interface RelevantFileDiscoveryResult {
  candidates: RelevantFileCandidate[];
  warnings: RelevantFileWarning[];
}

export interface DiscoverRelevantFilesInput {
  workspaceRoot: string;
  task: TaskRecord;
  workflow: WorkflowDefinition;
  templateDir: string;
  phaseId: string;
  definition: PhaseDefinition;
}

interface RawCandidate {
  value: string;
  source: RelevantFileSource;
  reason: string;
  variableName?: string;
  missingAllowed: boolean;
}

const SOURCE_PRIORITY: Record<RelevantFileSource, number> = {
  'context-ref': 0,
  'task-source': 1,
  variable: 2,
  workflow: 3,
  'rendered-prompt': 4,
  'project-doc-root': 5,
};

const PATH_VARIABLE_REGEX = /(?:_FILE|_PATH|_DOC)$/;
const BACKTICK_PATH_REGEX = /`([^`\n]+)`/g;
const PLACEHOLDER_VALUES = new Set([
  '(none)',
  '(not provided)',
  '(multiple context refs)',
]);

export async function discoverRelevantFiles(
  input: DiscoverRelevantFilesInput
): Promise<RelevantFileDiscoveryResult> {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const warnings: RelevantFileWarning[] = [];
  const rawCandidates: RawCandidate[] = [];
  const resolver = new VariableResolver();
  const variables = resolver.resolve(input.task, input.phaseId, input.workflow, input.definition);

  for (const ref of input.task.contextRefs ?? []) {
    rawCandidates.push({
      value: ref.path,
      source: 'context-ref',
      reason: `${ref.role} context`,
      missingAllowed: true,
    });
  }

  for (const sourceFile of await listExistingFiles(workspaceRoot, path.join(input.task.paths.taskRoot, 'sources'), warnings, 'task source root')) {
    rawCandidates.push({
      value: sourceFile,
      source: 'task-source',
      reason: 'task source file',
      missingAllowed: false,
    });
  }

  for (const [name, value] of Object.entries(variables)) {
    if (PATH_VARIABLE_REGEX.test(name)) {
      rawCandidates.push({
        value,
        source: 'variable',
        reason: `resolved variable ${name}`,
        variableName: name,
        missingAllowed: true,
      });
    }

    if (name === 'CONTEXT_FILES' || name === 'CONTEXT_REFS_DETAIL') {
      for (const parsed of parseBacktickedPaths(value)) {
        rawCandidates.push({
          value: parsed,
          source: 'variable',
          reason: `path listed in ${name}`,
          variableName: name,
          missingAllowed: true,
        });
      }
    }
  }

  for (const requiredName of input.definition.requiredVariables ?? []) {
    const value = variables[requiredName];
    if (value && isPotentialPathValue(value)) {
      rawCandidates.push({
        value,
        source: 'workflow',
        reason: `required variable ${requiredName}`,
        variableName: requiredName,
        missingAllowed: true,
      });
    }
  }

  for (const output of input.definition.outputs ?? []) {
    const resolvedOutput = resolveWorkflowPathValue(output, variables);
    rawCandidates.push({
      value: resolvedOutput.value,
      source: 'workflow',
      reason: `workflow output ${output}`,
      variableName: resolvedOutput.variableName,
      missingAllowed: true,
    });
  }

  for (const [artifactName, artifact] of Object.entries(input.workflow.artifacts ?? {})) {
    const resolvedArtifact = resolveWorkflowPathValue(artifact.path, variables);
    rawCandidates.push({
      value: resolvedArtifact.value,
      source: 'workflow',
      reason: `workflow artifact ${artifactName}`,
      variableName: resolvedArtifact.variableName,
      missingAllowed: true,
    });
  }

  try {
    const rendered = await new TemplateRenderer(workspaceRoot).render(
      input.definition.template,
      variables,
      input.templateDir
    );
    for (const parsed of parseBacktickedPaths(rendered)) {
      rawCandidates.push({
        value: parsed,
        source: 'rendered-prompt',
        reason: 'path referenced in rendered prompt',
        missingAllowed: true,
      });
    }
  } catch (error) {
    warnings.push({
      message: `Rendered prompt path discovery skipped: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  for (const docFile of await listExistingFiles(workspaceRoot, input.task.paths.projectDocRoot, warnings, 'project doc root')) {
    rawCandidates.push({
      value: docFile,
      source: 'project-doc-root',
      reason: 'existing project doc',
      missingAllowed: false,
    });
  }

  return {
    candidates: await normalizeCandidates(workspaceRoot, rawCandidates, warnings),
    warnings,
  };
}

async function normalizeCandidates(
  workspaceRoot: string,
  rawCandidates: RawCandidate[],
  warnings: RelevantFileWarning[]
): Promise<RelevantFileCandidate[]> {
  const workspaceRealPath = await realpath(workspaceRoot);
  const candidates = new Map<string, RelevantFileCandidate>();

  for (const raw of rawCandidates) {
    const pathValue = raw.value.trim();
    const invalidReason = invalidPathReason(pathValue);
    if (invalidReason) {
      warnings.push({ path: raw.value, message: `Ignored ${raw.reason}: ${invalidReason}` });
      continue;
    }

    const normalized = path.normalize(pathValue);
    if (normalized === '.' || normalized.startsWith(`..${path.sep}`) || normalized === '..') {
      warnings.push({ path: raw.value, message: `Ignored ${raw.reason}: path escapes workspace` });
      continue;
    }

    if (isTemplatePath(normalized)) {
      warnings.push({ path: raw.value, message: `Ignored ${raw.reason}: template dependency is not a user document` });
      continue;
    }

    const absolutePath = path.resolve(workspaceRoot, normalized);
    const relative = path.relative(workspaceRoot, absolutePath);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      warnings.push({ path: raw.value, message: `Ignored ${raw.reason}: path escapes workspace` });
      continue;
    }

    const existing = await classifyExistingFile(absolutePath, workspaceRealPath, raw.value, raw.reason, warnings);
    if (existing === 'unsafe') {
      continue;
    }
    if (existing === 'missing' && !raw.missingAllowed) {
      continue;
    }

    const canonicalPath = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
    const candidate: RelevantFileCandidate = {
      path: canonicalPath,
      absolutePath,
      exists: existing === 'file',
      source: raw.source,
      reason: raw.reason,
      ...(raw.variableName ? { variableName: raw.variableName } : {}),
    };

    const existingCandidate = candidates.get(canonicalPath);
    if (!existingCandidate || SOURCE_PRIORITY[candidate.source] < SOURCE_PRIORITY[existingCandidate.source]) {
      candidates.set(canonicalPath, candidate);
    }
  }

  return [...candidates.values()].sort((a, b) => {
    const priority = SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
    return priority === 0 ? a.path.localeCompare(b.path) : priority;
  });
}

async function classifyExistingFile(
  absolutePath: string,
  workspaceRealPath: string,
  originalPath: string,
  reason: string,
  warnings: RelevantFileWarning[]
): Promise<'file' | 'missing' | 'unsafe'> {
  try {
    const entryStat = await lstat(absolutePath);
    if (!entryStat.isFile() && !entryStat.isSymbolicLink()) {
      return 'missing';
    }

    const realFilePath = await realpath(absolutePath);
    const realRelative = path.relative(workspaceRealPath, realFilePath);
    if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
      warnings.push({ path: originalPath, message: `Ignored ${reason}: symlink escapes workspace` });
      return 'unsafe';
    }

    const realStat = await stat(realFilePath);
    return realStat.isFile() ? 'file' : 'missing';
  } catch {
    return 'missing';
  }
}

function invalidPathReason(value: string): string | null {
  if (!value) return 'empty path';
  if (PLACEHOLDER_VALUES.has(value.toLowerCase())) return 'placeholder value';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return 'URLs are not workspace files';
  if (path.isAbsolute(value)) return 'absolute paths are not accepted';
  if (/[|;&<>$]/.test(value)) return 'shell-looking value';
  if (value.includes('\0')) return 'invalid path bytes';
  return null;
}

function isTemplatePath(value: string): boolean {
  const normalized = value.split(path.sep).join('/');
  return normalized.startsWith('.playspec/templates/') || normalized.includes('/templates/');
}

function isPotentialPathValue(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.includes('/') || trimmed.includes('\\') || /\.[a-z0-9]+$/i.test(trimmed);
}

function parseBacktickedPaths(value: string): string[] {
  const paths: string[] = [];
  for (const match of value.matchAll(BACKTICK_PATH_REGEX)) {
    const candidate = match[1].trim();
    if (isPotentialPathValue(candidate)) {
      paths.push(candidate);
    }
  }
  return paths;
}

function resolveWorkflowPathValue(
  value: string,
  variables: Record<string, string>
): { value: string; variableName?: string } {
  const trimmed = value.trim();
  const placeholder = trimmed.match(/^\{\{\s*([A-Z0-9_]+)\s*\}\}$/);
  const variableName = placeholder?.[1] ?? trimmed;
  if (variables[variableName]) {
    return { value: variables[variableName], variableName };
  }
  return { value: trimmed };
}

async function listExistingFiles(
  workspaceRoot: string,
  relativeRoot: string,
  warnings: RelevantFileWarning[],
  reason: string
): Promise<string[]> {
  const invalidReason = invalidPathReason(relativeRoot);
  if (invalidReason) {
    warnings.push({ path: relativeRoot, message: `Ignored ${reason}: ${invalidReason}` });
    return [];
  }

  const normalizedRoot = path.normalize(relativeRoot);
  const absoluteRoot = path.resolve(workspaceRoot, normalizedRoot);
  const relative = path.relative(workspaceRoot, absoluteRoot);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    warnings.push({ path: relativeRoot, message: `Ignored ${reason}: path escapes workspace` });
    return [];
  }

  try {
    const scanStat = await stat(absoluteRoot);
    if (!scanStat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  return readFilesRecursively(absoluteRoot, normalizedRoot);
}

async function readFilesRecursively(absoluteRoot: string, relativeRoot: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(absoluteRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const absoluteEntry = path.join(absoluteRoot, entry.name);
    const relativeEntry = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readFilesRecursively(absoluteEntry, relativeEntry));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(relativeEntry.split(path.sep).join('/'));
    }
  }
  return files.sort();
}
