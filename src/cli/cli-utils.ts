import path from 'node:path';
import { mkdir, realpath } from 'node:fs/promises';
import chalk from 'chalk';
import { PlaySpecError } from '#core/errors.js';
import { readTextFile } from '#utils/fs.js';
import { getHeadPath } from '#utils/paths.js';
import type { TaskContextRef, TaskRecord, TaskSummary, WorkflowDefinition } from '#core/types.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { formatGateRoutes, formatNextRoute, gateResults, phaseDisplayInfo } from '#workflow/phase-display.js';

export function isInteractiveCli(): boolean {
  const forced = process.env.PLAY_SPEC_NON_INTERACTIVE;
  const forcedNonInteractive =
    forced !== undefined && forced !== '' && forced !== '0' && forced.toLowerCase() !== 'false';
  return process.stdin.isTTY === true && process.stdout.isTTY === true && !process.env.CI && !forcedNonInteractive;
}

export async function readHeadTaskId(workspaceRoot: string): Promise<string | null> {
  try {
    const content = await readTextFile(getHeadPath(workspaceRoot));
    return content.trim() || null;
  } catch {
    return null;
  }
}

export function formatContextRef(ref: TaskContextRef): string {
  return `${ref.path} (${ref.role}, source: ${ref.source})`;
}

export interface EffectivePhaseDisplay {
  phaseDisplay: string;
  phaseLabel: string;
  phaseIdDisplay: string;
  gateRouteLines: string[];
  nextRouteLines: string[];
  isEffective: boolean;
  isInvalid: boolean;
  allowedPhaseIds: string[];
}

export function computeEffectivePhaseDisplay(
  task: Pick<TaskRecord | TaskSummary, 'currentPhase' | 'workflow'>,
  workflow: WorkflowDefinition,
): EffectivePhaseDisplay {
  const phaseOrder = workflow.phaseOrder;

  if (task.currentPhase === null) {
    const firstId = phaseOrder[0];
    if (!firstId) {
      return { phaseDisplay: '(not started)', phaseLabel: 'Phase', phaseIdDisplay: '', gateRouteLines: [], nextRouteLines: [], isEffective: false, isInvalid: false, allowedPhaseIds: phaseOrder };
    }
    const firstDef = workflow.phases[firstId];
    if (!firstDef) {
      return { phaseDisplay: `${firstId} (effective)`, phaseLabel: 'Phase', phaseIdDisplay: '', gateRouteLines: [], nextRouteLines: [], isEffective: true, isInvalid: false, allowedPhaseIds: phaseOrder };
    }
    const display = phaseDisplayInfo(firstId, firstDef);
    const phaseLabel = firstDef.stepNumber ? 'Step' : 'Phase';
    const phaseDisplay = firstDef.stepNumber ? `${display.label} (effective)` : `${display.id} — ${display.title} (effective)`;
    const phaseIdDisplay = firstDef.stepNumber ? `${display.id} (effective)` : '';
    const gateRouteLines = firstDef.stepNumber && gateResults(firstDef).length > 0 ? formatGateRoutes(workflow, firstDef) : [];
    const nextRouteLines = firstDef.stepNumber && gateResults(firstDef).length === 0 && firstDef.next !== undefined ? formatNextRoute(workflow, firstDef) : [];
    return { phaseDisplay, phaseLabel, phaseIdDisplay, gateRouteLines, nextRouteLines, isEffective: true, isInvalid: false, allowedPhaseIds: phaseOrder };
  }

  const inOrder = phaseOrder.includes(task.currentPhase);
  const definition = workflow.phases[task.currentPhase];

  if (!inOrder || !definition) {
    const invalidMsg = chalk.red(`INVALID (${task.currentPhase}) — Allowed: ${phaseOrder.join(', ')}`);
    return { phaseDisplay: invalidMsg, phaseLabel: 'Phase', phaseIdDisplay: '', gateRouteLines: [], nextRouteLines: [], isEffective: false, isInvalid: true, allowedPhaseIds: phaseOrder };
  }

  const display = phaseDisplayInfo(task.currentPhase, definition);
  const phaseLabel = definition.stepNumber ? 'Step' : 'Phase';
  const phaseDisplay = definition.stepNumber ? display.label : `${display.id} — ${display.title}`;
  const phaseIdDisplay = definition.stepNumber ? display.id : '';
  const gateRouteLines = definition.stepNumber && gateResults(definition).length > 0 ? formatGateRoutes(workflow, definition) : [];
  const nextRouteLines = definition.stepNumber && gateResults(definition).length === 0 && definition.next !== undefined ? formatNextRoute(workflow, definition) : [];
  return { phaseDisplay, phaseLabel, phaseIdDisplay, gateRouteLines, nextRouteLines, isEffective: false, isInvalid: false, allowedPhaseIds: phaseOrder };
}

export async function resolveEffectivePhaseDisplay(
  task: Pick<TaskRecord | TaskSummary, 'currentPhase' | 'workflow'>,
  workflowLoader: WorkflowLoader,
): Promise<EffectivePhaseDisplay> {
  try {
    const workflow = await workflowLoader.load(task.workflow);
    return computeEffectivePhaseDisplay(task, workflow);
  } catch {
    return { phaseDisplay: task.currentPhase ?? '(not started)', phaseLabel: 'Phase', phaseIdDisplay: '', gateRouteLines: [], nextRouteLines: [], isEffective: false, isInvalid: false, allowedPhaseIds: [] };
  }
}

export function formatCompactPhaseDisplay(
  task: Pick<TaskRecord | TaskSummary, 'currentPhase' | 'workflow'>,
  workflow: WorkflowDefinition,
): { phase: string; allowed?: string } {
  const phaseOrder = workflow.phaseOrder;
  const phaseId = task.currentPhase ?? phaseOrder[0];

  if (!phaseId) {
    return { phase: '(not started)' };
  }

  const definition = workflow.phases[phaseId];
  if (!phaseOrder.includes(phaseId) || !definition) {
    return {
      phase: `INVALID (${phaseId})`,
      allowed: phaseOrder.join(', '),
    };
  }

  const display = phaseDisplayInfo(phaseId, definition);
  return { phase: `${display.number} — ${display.title}` };
}

export async function formatCompactCurrentTaskSummary(
  task: Pick<TaskRecord, 'id' | 'title' | 'workflow' | 'currentPhase' | 'contextRefs'>,
  workflowLoader: WorkflowLoader,
): Promise<string> {
  let phase = task.currentPhase ?? '(not started)';
  let allowed: string | undefined;
  try {
    const workflow = await workflowLoader.load(task.workflow);
    const compact = formatCompactPhaseDisplay(task, workflow);
    phase = compact.phase;
    allowed = compact.allowed;
  } catch {
    // Keep summary display-only even if workflow assets are unavailable.
  }

  const lines = [
    'Current task:',
    `  Task ID:  ${task.id}`,
    `  Title:    ${task.title}`,
    `  Workflow: ${task.workflow}`,
    `  Phase:    ${phase}`,
  ];

  if (allowed) {
    lines.push(`  Allowed:  ${allowed}`);
  }

  const contextRefsCount = task.contextRefs?.length ?? 0;
  if (contextRefsCount > 0) {
    lines.push(`  Context:  ${contextRefsCount} linked file(s)`);
  }

  lines.push('', 'Next:', '  playspec prompt');
  return lines.join('\n');
}

async function resolvePathWithExistingRealPrefix(targetPath: string): Promise<string> {
  const pendingSegments: string[] = [];
  let currentPath = targetPath;

  while (true) {
    try {
      const realPrefix = await realpath(currentPath);
      return path.join(realPrefix, ...pendingSegments.reverse());
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        throw error;
      }

      pendingSegments.push(path.basename(currentPath));
      currentPath = parentPath;
    }
  }
}

export async function resolveOutputFilePath(workspaceRoot: string, outputPath: string): Promise<string> {
  const workspaceRealPath = await realpath(workspaceRoot);
  const resolvedPath = path.isAbsolute(outputPath)
    ? path.normalize(outputPath)
    : path.resolve(workspaceRealPath, outputPath);

  const realBoundaryPath = await resolvePathWithExistingRealPrefix(resolvedPath);
  const relativePath = path.relative(workspaceRealPath, realBoundaryPath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new PlaySpecError(
      `Output path escapes workspace: ${outputPath}`,
      'Choose an output path inside the workspace or use a workspace-relative path.'
    );
  }

  const parentDir = path.dirname(realBoundaryPath);
  await mkdir(parentDir, { recursive: true });

  const realParent = await realpath(parentDir);
  const parentRelativePath = path.relative(workspaceRealPath, realParent);
  if (
    parentRelativePath === '..' ||
    parentRelativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(parentRelativePath)
  ) {
    throw new PlaySpecError(
      `Output path escapes workspace through a symlink: ${outputPath}`,
      'Choose an output path inside the workspace or use a workspace-relative path.'
    );
  }

  return realBoundaryPath;
}
