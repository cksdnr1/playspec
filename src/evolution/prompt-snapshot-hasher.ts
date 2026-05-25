import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { VariableResolver } from '#template/variable-resolver.js';
import { TemplateRenderer } from '#template/template-renderer.js';
import { assertRequiredVariables } from '#core/required-variables.js';
import type { PhaseDefinition, ResolvedWorkflow, TaskRecord } from '#core/types.js';
import type { FeedbackPromptSnapshot } from './types.js';

export class PromptSnapshotHasher {
  private readonly variableResolver = new VariableResolver();
  private readonly templateRenderer: TemplateRenderer;

  constructor(private readonly workspaceRoot: string) {
    this.templateRenderer = new TemplateRenderer(workspaceRoot);
  }

  async hashTargetPrompt(
    task: TaskRecord,
    workflow: ResolvedWorkflow,
    targetPhaseId: string,
    createdAt = new Date()
  ): Promise<FeedbackPromptSnapshot> {
    const definition = workflow.definition.phases[targetPhaseId];
    if (!definition) {
      throw new Error(`Cannot hash feedback prompt snapshot; workflow "${workflow.id}" has no phase "${targetPhaseId}".`);
    }

    const rendered = await this.renderTargetPrompt(task, workflow, targetPhaseId, definition);
    const renderedBuffer = Buffer.from(rendered, 'utf8');
    return {
      algorithm: 'sha256',
      hash: createHash('sha256').update(renderedBuffer).digest('hex'),
      renderedByteLength: renderedBuffer.byteLength,
      targetPhaseId,
      templatePath: definition.template,
      templatePathKind: 'workflow_relative',
      createdAt: createdAt.toISOString(),
      workflowVersion: workflow.definition.version,
    };
  }

  private async renderTargetPrompt(
    task: TaskRecord,
    workflow: ResolvedWorkflow,
    targetPhaseId: string,
    definition: PhaseDefinition
  ): Promise<string> {
    const variables = this.variableResolver.resolve(task, targetPhaseId, workflow.definition, definition);
    assertRequiredVariables(workflow.id, targetPhaseId, definition, workflow.definition.variables, variables);
    return this.templateRenderer.render(definition.template, variables, workflow.templateDir);
  }
}
