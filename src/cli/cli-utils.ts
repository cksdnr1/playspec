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
  task: Pick<TaskRecord | TaskSummary, 'currentPhase' | 'workflowType'>,
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
    const invalidMsg = chalk.red(`INVALID (${task.currentPhase}) — allowed: ${phaseOrder.join(', ')}`);
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
  task: Pick<TaskRecord | TaskSummary, 'currentPhase' | 'workflowType'>,
  workflowLoader: WorkflowLoader,
): Promise<EffectivePhaseDisplay> {
  try {
    const workflow = await workflowLoader.load(task.workflowType);
    return computeEffectivePhaseDisplay(task, workflow);
  } catch {
    return { phaseDisplay: task.currentPhase ?? '(not started)', phaseLabel: 'Phase', phaseIdDisplay: '', gateRouteLines: [], nextRouteLines: [], isEffective: false, isInvalid: false, allowedPhaseIds: [] };
  }
}

export async function resolveOutputFilePath(workspaceRoot: string, outputPath: string): Promise<string> {
  const workspaceRealPath = await realpath(workspaceRoot);
  const resolvedPath = path.isAbsolute(outputPath)
    ? path.normalize(outputPath)
    : path.resolve(workspaceRealPath, outputPath);

  if (!path.isAbsolute(outputPath)) {
    const relativePath = path.relative(workspaceRealPath, resolvedPath);
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      throw new PlaySpecError(
        `Output path escapes workspace: ${outputPath}`,
        'Use a workspace-relative path that stays inside the workspace.'
      );
    }
  }

  const parentDir = path.dirname(resolvedPath);
  await mkdir(parentDir, { recursive: true });

  if (!path.isAbsolute(outputPath)) {
    const realParent = await realpath(parentDir);
    const parentRelativePath = path.relative(workspaceRealPath, realParent);
    if (
      parentRelativePath === '..' ||
      parentRelativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(parentRelativePath)
    ) {
      throw new PlaySpecError(
        `Output path escapes workspace through a symlink: ${outputPath}`,
        'Choose an output path whose parent directory resolves inside the workspace.'
      );
    }
  }

  return resolvedPath;
}
