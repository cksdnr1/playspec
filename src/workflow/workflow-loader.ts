import { WorkflowPackRegistry } from '#pack/pack-registry.js';
import type { ResolvedWorkflow } from '#pack/pack-registry.js';
import type { WorkflowDefinition, WorkflowPackRef } from '#core/types.js';

export class WorkflowLoader {
  private readonly registry: WorkflowPackRegistry;

  constructor(private readonly workspaceRoot: string) {
    this.registry = new WorkflowPackRegistry(workspaceRoot);
  }

  async load(workflowType: string): Promise<WorkflowDefinition> {
    return (await this.loadResolved(workflowType)).workflow;
  }

  async loadResolved(workflowType: string, packRef?: WorkflowPackRef): Promise<ResolvedWorkflow> {
    return this.registry.resolveWorkflow(workflowType, packRef);
  }
}
