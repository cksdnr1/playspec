import { access } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { WorkflowDefinitionSchema } from './workflow-schema.js';
import { TemplateNotFoundError } from '#core/errors.js';
import type { ResolvedWorkflow, WorkflowDefinition } from '#core/types.js';
import { readTextFile } from '#utils/fs.js';
import { WorkflowRegistry } from './workflow-registry.js';

export class WorkflowLoader {
  private readonly registry: WorkflowRegistry;

  constructor(private readonly workspaceRoot: string) {
    this.registry = new WorkflowRegistry(workspaceRoot);
  }

  async load(workflow: string): Promise<WorkflowDefinition> {
    return (await this.resolve(workflow)).definition;
  }

  async resolve(workflow: string): Promise<ResolvedWorkflow> {
    const location = this.getRegistry().resolve(workflow);
    const resolvedLocation = await location;
    const content = await readTextFile(resolvedLocation.workflowFile);
    const definition = WorkflowDefinitionSchema.parse(parseYaml(content) as unknown);
    if (definition.id !== workflow) {
      throw new Error(
        `Workflow id mismatch: requested "${workflow}" but ${resolvedLocation.workflowFile} declares "${definition.id}".`
      );
    }
    await this.validateWorkflowDefinition(definition, resolvedLocation.templateDir);
    return {
      id: definition.id,
      rootDir: resolvedLocation.rootDir,
      templateDir: resolvedLocation.templateDir,
      source: resolvedLocation.source,
      definition,
    };
  }

  async resolveFromDirectory(rootDir: string): Promise<ResolvedWorkflow> {
    const workflowFile = `${rootDir}/workflow.yaml`;
    const content = await readTextFile(workflowFile);
    const definition = WorkflowDefinitionSchema.parse(parseYaml(content) as unknown);
    await this.validateWorkflowDefinition(definition, `${rootDir}/templates`);
    return {
      id: definition.id,
      rootDir,
      templateDir: `${rootDir}/templates`,
      source: 'user',
      definition,
    };
  }

  private getRegistry(): WorkflowRegistry {
    return this.registry;
  }

  async validateWorkflowDefinition(definition: WorkflowDefinition, templateDir: string): Promise<void> {
    for (const phaseId of definition.phaseOrder) {
      const phase = definition.phases[phaseId];
      if (!phase) {
        throw new Error(`Workflow ${definition.id} phaseOrder references missing phase "${phaseId}".`);
      }
      const templatePath = this.resolveTemplatePath(templateDir, phase.template);
      try {
        await access(templatePath);
      } catch {
        throw new TemplateNotFoundError(templatePath);
      }
    }
  }

  private resolveTemplatePath(templateDir: string, templatePath: string): string {
    if (path.isAbsolute(templatePath)) {
      throw new Error(`Workflow template path must be relative: ${templatePath}`);
    }
    const resolved = path.resolve(templateDir, templatePath);
    const relative = path.relative(templateDir, resolved);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`Workflow template path escapes templates directory: ${templatePath}`);
    }
    return resolved;
  }
}
