import { PhaseNotFoundError } from '#core/errors.js';
import type { TaskRecord, WorkflowDefinition, PhaseDefinition } from '#core/types.js';

export interface ResolvedPhase {
  phaseId: string;
  definition: PhaseDefinition;
}

export class PhaseResolver {
  resolveCurrentPhase(task: TaskRecord, workflow: WorkflowDefinition): ResolvedPhase {
    const { phaseOrder, phases } = workflow;

    if (task.currentPhase === null) {
      const firstId = phaseOrder[0];
      if (!firstId) {
        throw new PhaseNotFoundError('(first)', workflow.id);
      }
      const definition = phases[firstId];
      if (!definition) {
        throw new PhaseNotFoundError(firstId, workflow.id);
      }
      return { phaseId: firstId, definition };
    }

    return this.resolveExplicitPhase(task.currentPhase, workflow);
  }

  /**
   * Returns the next phase for a task.
   * If currentPhase is null, returns the first phase from phaseOrder.
   * Otherwise returns the phase after the current one.
   */
  resolveNextPhase(task: TaskRecord, workflow: WorkflowDefinition): ResolvedPhase {
    const { phaseOrder, phases } = workflow;

    if (task.currentPhase === null) {
      const firstId = phaseOrder[0];
      if (!firstId) {
        throw new PhaseNotFoundError('(first)', workflow.id);
      }
      const definition = phases[firstId];
      if (!definition) {
        throw new PhaseNotFoundError(firstId, workflow.id);
      }
      return { phaseId: firstId, definition };
    }

    const currentIndex = phaseOrder.indexOf(task.currentPhase);
    if (currentIndex === -1) {
      throw new PhaseNotFoundError(task.currentPhase, workflow.id);
    }

    const currentDefinition = phases[task.currentPhase];
    if (currentDefinition?.next !== undefined) {
      if (currentDefinition.next === null) {
        throw new PhaseNotFoundError(`(after ${task.currentPhase})`, workflow.id);
      }
      const definition = phases[currentDefinition.next];
      if (!definition) {
        throw new PhaseNotFoundError(currentDefinition.next, workflow.id);
      }
      return { phaseId: currentDefinition.next, definition };
    }

    const nextId = phaseOrder[currentIndex + 1];
    if (!nextId) {
      throw new PhaseNotFoundError(
        `(after ${task.currentPhase})`,
        workflow.id
      );
    }

    const definition = phases[nextId];
    if (!definition) {
      throw new PhaseNotFoundError(nextId, workflow.id);
    }

    return { phaseId: nextId, definition };
  }

  /**
   * Returns the phase with the given explicit ID.
   */
  resolveExplicitPhase(phaseId: string, workflow: WorkflowDefinition): ResolvedPhase {
    const definition = workflow.phases[phaseId];
    if (!definition) {
      throw new PhaseNotFoundError(phaseId, workflow.id);
    }
    return { phaseId, definition };
  }
}
