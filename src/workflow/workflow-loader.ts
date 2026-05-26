import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { WorkflowDefinitionSchema } from './workflow-schema.js';
import { TemplateNotFoundError } from '#core/errors.js';
import type { ResolvedWorkflow, WorkflowDefinition, WorkflowSource } from '#core/types.js';
import { readTextFile } from '#utils/fs.js';
import { assertSafeWorkflowId, WorkflowLocation, WorkflowRegistry } from './workflow-registry.js';

export class WorkflowLoader {
  private readonly registry: WorkflowRegistry;

  constructor(private readonly workspaceRoot: string) {
    this.registry = new WorkflowRegistry(workspaceRoot);
  }

  async load(workflow: string): Promise<WorkflowDefinition> {
    assertSafeWorkflowId(workflow);
    return (await this.resolve(workflow)).definition;
  }

  async resolve(workflow: string): Promise<ResolvedWorkflow> {
    assertSafeWorkflowId(workflow);
    const location = this.getRegistry().resolve(workflow);
    const resolvedLocation = await location;
    const selected = await this.loadResolvedLocation(workflow, resolvedLocation);
    if (resolvedLocation.source === 'builtin') {
      return selected;
    }

    const builtinLocation = await this.getBuiltinLocationIfPresent(workflow);
    if (!builtinLocation) {
      return selected;
    }

    const builtin = await this.loadResolvedLocation(workflow, builtinLocation);
    const differsFromBuiltin = !(await this.workflowAssetsEqual(selected, builtin));
    const accepted = selected.definition.builtinShadow?.accepted === true;
    const shadow = {
      effectiveSource: differsFromBuiltin && !accepted ? 'builtin' as WorkflowSource : selected.source,
      shadowSource: selected.source as Exclude<WorkflowSource, 'builtin'>,
      shadowRootDir: selected.rootDir,
      builtinRootDir: builtin.rootDir,
      differsFromBuiltin,
      accepted,
      usingBuiltinFallback: differsFromBuiltin && !accepted,
    };

    if (shadow.usingBuiltinFallback) {
      return {
        ...builtin,
        shadow,
      };
    }

    return {
      ...selected,
      shadow,
    };
  }

  async resolveFromDirectory(rootDir: string): Promise<ResolvedWorkflow> {
    const location = this.resolveDirectoryLocation(rootDir);
    const workflowFile = path.join(location.rootDir, 'workflow.yaml');
    const content = await readTextFile(workflowFile);
    const definition = WorkflowDefinitionSchema.parse(parseYaml(content) as unknown);
    assertSafeWorkflowId(definition.id);
    if (definition.id !== location.id) {
      throw new Error(`Workflow id mismatch: directory "${location.id}" but ${workflowFile} declares "${definition.id}".`);
    }
    await this.validateWorkflowDefinition(definition, location.templateDir);
    return {
      id: definition.id,
      rootDir: location.rootDir,
      templateDir: location.templateDir,
      source: location.source,
      definition,
    };
  }

  private getRegistry(): WorkflowRegistry {
    return this.registry;
  }

  private async loadResolvedLocation(workflow: string, location: WorkflowLocation): Promise<ResolvedWorkflow> {
    const content = await readTextFile(location.workflowFile);
    const definition = WorkflowDefinitionSchema.parse(parseYaml(content) as unknown);
    if (definition.id !== workflow) {
      throw new Error(
        `Workflow id mismatch: requested "${workflow}" but ${location.workflowFile} declares "${definition.id}".`
      );
    }
    await this.validateWorkflowDefinition(definition, location.templateDir);
    return {
      id: definition.id,
      rootDir: location.rootDir,
      templateDir: location.templateDir,
      source: location.source,
      definition,
    };
  }

  private async getBuiltinLocationIfPresent(workflow: string): Promise<WorkflowLocation | null> {
    const rootDir = path.join(this.getRegistry().getBuiltinRoot(), workflow);
    const workflowFile = path.join(rootDir, 'workflow.yaml');
    try {
      await access(workflowFile);
      return {
        id: workflow,
        rootDir,
        workflowFile,
        templateDir: path.join(rootDir, 'templates'),
        source: 'builtin',
      };
    } catch {
      return null;
    }
  }

  private async workflowAssetsEqual(left: ResolvedWorkflow, right: ResolvedWorkflow): Promise<boolean> {
    return (await this.workflowAssetSignature(left)) === (await this.workflowAssetSignature(right));
  }

  private async workflowAssetSignature(workflow: ResolvedWorkflow): Promise<string> {
    const normalizedDefinition = {
      ...workflow.definition,
      builtinShadow: undefined,
    };
    return JSON.stringify({
      definition: normalizedDefinition,
      templates: await this.directoryFiles(workflow.templateDir),
    });
  }

  private async directoryFiles(rootDir: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    await this.collectDirectoryFiles(rootDir, rootDir, files);
    return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
  }

  private async collectDirectoryFiles(rootDir: string, currentDir: string, files: Record<string, string>): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await this.collectDirectoryFiles(rootDir, absolutePath, files);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');
      files[relativePath] = await readFile(absolutePath, 'utf8');
    }
  }

  async validateWorkflowDefinition(definition: WorkflowDefinition, templateDir: string): Promise<void> {
    for (const phaseId of definition.phaseOrder) {
      const phase = definition.phases[phaseId];
      if (!phase) {
        throw new Error(`Workflow ${definition.id} phaseOrder references missing phase "${phaseId}".`);
      }
      this.validateFeedbackPhaseReferences(definition, phaseId);
      const templatePath = this.resolveTemplatePath(templateDir, phase.template);
      try {
        await access(templatePath);
      } catch {
        throw new TemplateNotFoundError(templatePath);
      }
    }
  }

  private validateFeedbackPhaseReferences(definition: WorkflowDefinition, phaseId: string): void {
    const feedback = definition.phases[phaseId]?.feedback;
    if (!feedback) {
      return;
    }

    const references = [
      ['sourcePhaseId', feedback.sourcePhaseId],
      ['evaluatedArtifactPhaseId', feedback.evaluatedArtifactPhaseId],
      ['evolutionTargetPhaseId', feedback.evolutionTargetPhaseId],
    ] as const;

    for (const [field, referencedPhaseId] of references) {
      if (!definition.phases[referencedPhaseId]) {
        throw new Error(
          `Workflow ${definition.id} phase "${phaseId}" feedback.${field} references missing phase "${referencedPhaseId}".`
        );
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

  private resolveDirectoryLocation(rootDir: string): {
    id: string;
    rootDir: string;
    templateDir: string;
    source: ResolvedWorkflow['source'];
  } {
    if (rootDir.includes('\0')) {
      throw new Error(`Workflow directory must not contain null bytes: ${rootDir}`);
    }

    const registry = this.getRegistry();
    const resolvedRootDir = path.resolve(rootDir);
    const sourceRoots = [
      { source: 'project' as const, root: registry.getProjectRoot() },
      { source: 'user' as const, root: registry.getUserRoot() },
      { source: 'builtin' as const, root: registry.getBuiltinRoot() },
    ];

    for (const { source, root } of sourceRoots) {
      const sourceRoot = path.resolve(root);
      const relative = path.relative(sourceRoot, resolvedRootDir);
      const outsideSourceRoot = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
      if (outsideSourceRoot) {
        continue;
      }
      if (relative === '') {
        throw new Error(`Workflow directory must be a direct child of a known workflow source root: ${rootDir}`);
      }

      const segments = relative.split(path.sep).filter(Boolean);
      if (segments.length !== 1) {
        throw new Error(`Workflow directory must be a direct child of a known workflow source root: ${rootDir}`);
      }

      const id = segments[0] ?? '';
      assertSafeWorkflowId(id);
      return {
        id,
        rootDir: resolvedRootDir,
        templateDir: path.join(resolvedRootDir, 'templates'),
        source,
      };
    }

    const id = path.basename(resolvedRootDir);
    assertSafeWorkflowId(id);
    return {
      id,
      rootDir: resolvedRootDir,
      templateDir: path.join(resolvedRootDir, 'templates'),
      source: 'user',
    };
  }
}
