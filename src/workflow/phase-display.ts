import type { PhaseDefinition, PhaseId, WorkflowDefinition } from '#core/types.js';

export interface PhaseDisplayInfo {
  id: PhaseId;
  number: string;
  title: string;
  label: string;
}

export function phaseDisplayInfo(phaseId: PhaseId, definition: PhaseDefinition): PhaseDisplayInfo {
  const number = definition.stepNumber ?? phaseId;
  const title = definition.stepTitle ?? definition.title;
  return {
    id: phaseId,
    number,
    title,
    label: `${number}. ${title}`,
  };
}

export function gateResults(definition: PhaseDefinition): string[] {
  return definition.gate?.results ?? definition.results ?? [];
}

export function gateTargets(definition: PhaseDefinition): Record<string, PhaseId> {
  return definition.gate?.nextByResult ?? definition.nextByResult ?? {};
}

export function formatGateRoutes(
  workflow: WorkflowDefinition,
  definition: PhaseDefinition
): string[] {
  const targets = gateTargets(definition);
  return gateResults(definition).map((result) => {
    const targetId = targets[result];
    const targetDefinition = targetId ? workflow.phases[targetId] : undefined;
    const targetLabel = targetDefinition
      ? phaseDisplayInfo(targetId, targetDefinition).label
      : targetId ?? '(missing target)';
    return `- ${result} -> ${targetLabel}`;
  });
}

export function formatNextRoute(
  workflow: WorkflowDefinition,
  definition: PhaseDefinition
): string[] {
  if (definition.next === undefined || definition.next === null) return [];
  const targetId = definition.next;
  const targetDefinition = workflow.phases[targetId];
  const targetLabel = targetDefinition
    ? phaseDisplayInfo(targetId, targetDefinition).label
    : targetId;
  return [`- ${targetLabel}`];
}
