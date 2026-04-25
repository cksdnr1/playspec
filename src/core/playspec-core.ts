import { WorkflowLoader } from '../workflow/workflow-loader.js';
import { PhaseResolver } from '../workflow/phase-resolver.js';
import { VariableResolver } from '../template/variable-resolver.js';
import { TemplateRenderer } from '../template/template-renderer.js';
import type { TaskStore } from '../storage/task-store.js';

export class PlaySpecCore {
  private readonly workflowLoader: WorkflowLoader;
  private readonly phaseResolver: PhaseResolver;
  private readonly variableResolver: VariableResolver;
  private readonly templateRenderer: TemplateRenderer;

  constructor(
    private readonly workspaceRoot: string,
    private readonly taskStore: TaskStore
  ) {
    this.workflowLoader = new WorkflowLoader(workspaceRoot);
    this.phaseResolver = new PhaseResolver();
    this.variableResolver = new VariableResolver();
    this.templateRenderer = new TemplateRenderer(workspaceRoot);
  }

  async renderNextPrompt(taskId: string): Promise<string> {
    const task = await this.taskStore.getTask(taskId);
    const workflow = await this.workflowLoader.load(task.workflowType);
    const { phaseId, definition } = this.phaseResolver.resolveNextPhase(task, workflow);
    const variables = this.variableResolver.resolve(task, phaseId);
    return this.templateRenderer.render(definition.template, variables);
  }

  async renderExplicitPhasePrompt(taskId: string, phaseId: string): Promise<string> {
    const task = await this.taskStore.getTask(taskId);
    const workflow = await this.workflowLoader.load(task.workflowType);
    const { definition } = this.phaseResolver.resolveExplicitPhase(phaseId, workflow);
    const variables = this.variableResolver.resolve(task, phaseId);
    return this.templateRenderer.render(definition.template, variables);
  }
}
