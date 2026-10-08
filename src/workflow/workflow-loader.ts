import { access } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { WorkflowDefinitionSchema } from './workflow-schema.js';
import { TemplateNotFoundError, MissingResultMappingError, InvalidRoutingTargetError } from '#core/errors.js';
import type {
  PhaseDefinition,
  ResolvedWorkflow,
  WorkflowDefinition,
  WorkflowDiagnostic,
  WorkflowDiagnosticDetail,
} from '#core/types.js';
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
    return this.attachBuiltinShadowDiagnostics(selected);
  }

  async listWithDiagnostics(): Promise<ResolvedWorkflow[]> {
    const locations = await this.getRegistry().list();
    const workflows: ResolvedWorkflow[] = [];
    for (const location of locations) {
      const selected = await this.loadResolvedLocation(location.id, location);
      workflows.push(await this.attachBuiltinShadowDiagnostics(selected));
    }
    return workflows;
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

  async validateWorkflowDefinition(definition: WorkflowDefinition, templateDir: string): Promise<void> {
    if (definition.phaseOrder.length === 0 || new Set(definition.phaseOrder).size !== definition.phaseOrder.length) {
      throw new Error(`Workflow ${definition.id} phaseOrder must be nonempty and contain unique phase IDs.`);
    }
    for (const phaseId of new Set([...definition.phaseOrder, ...Object.keys(definition.phases)])) {
      assertSafeWorkflowPhaseId(definition.id, phaseId);
    }

    for (const phaseId of new Set([...definition.phaseOrder, ...Object.keys(definition.phases)])) {
      const phase = definition.phases[phaseId];
      if (!phase) {
        throw new Error(`Workflow ${definition.id} phaseOrder references missing phase "${phaseId}".`);
      }
      this.validateFeedbackPhaseReferences(definition, phaseId);
      if (typeof phase.next === 'string' && (!definition.phases[phase.next] || !definition.phaseOrder.includes(phase.next))) {
        throw new Error(`Workflow ${definition.id} phase "${phaseId}" next references missing or unordered phase "${phase.next}".`);
      }
      const results = phase.gate?.results ?? phase.results;
      const routes = phase.gate?.nextByResult ?? phase.nextByResult;
      if (phase.gate?.validation && !results?.includes(phase.gate.validation.approvalResult ?? 'approved')) {
        throw new Error(`Workflow ${definition.id} phase "${phaseId}" validation approvalResult must be a declared gate result.`);
      }
      for (const result of results ?? []) {
        if (!routes || !Object.hasOwn(routes, result)) throw new MissingResultMappingError(phaseId, result);
      }
      for (const [result, target] of Object.entries(routes ?? {})) {
        if (!results?.includes(result)) throw new Error(`Workflow ${definition.id} phase "${phaseId}" has an undeclared result mapping "${result}".`);
        if (!definition.phases[target] || !definition.phaseOrder.includes(target)) {
          throw new InvalidRoutingTargetError(phaseId, result, target, definition.id);
        }
      }
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

  private async attachBuiltinShadowDiagnostics(selected: ResolvedWorkflow): Promise<ResolvedWorkflow> {
    if (selected.source === 'builtin') {
      return selected;
    }

    const builtinLocation = await this.getBuiltinLocationIfPresent(selected.id);
    if (!builtinLocation) {
      return selected;
    }

    const builtin = await this.loadResolvedLocation(selected.id, builtinLocation);
    const details = this.compareDiagnosticFields(selected.definition, builtin.definition);
    const differsFromBuiltin = details.length > 0;
    const diagnostics = differsFromBuiltin
      ? [this.createBuiltinShadowDiagnostic(selected, builtin, details)]
      : undefined;

    return {
      ...selected,
      diagnostics,
      shadow: {
        effectiveSource: selected.source,
        shadowSource: selected.source,
        shadowRootDir: selected.rootDir,
        builtinRootDir: builtin.rootDir,
        differsFromBuiltin,
        accepted: selected.definition.builtinShadow?.accepted === true,
        usingBuiltinFallback: false,
      },
    };
  }

  private compareDiagnosticFields(active: WorkflowDefinition, builtin: WorkflowDefinition): WorkflowDiagnosticDetail[] {
    const details: WorkflowDiagnosticDetail[] = [];
    this.addValueDifference(details, 'version', active.version, builtin.version);
    this.addValueDifference(details, 'artifacts', active.artifacts ?? {}, builtin.artifacts ?? {});

    const phaseIds = [...new Set([...Object.keys(active.phases), ...Object.keys(builtin.phases)])].sort();
    for (const phaseId of phaseIds) {
      const activeOutputs = this.phaseOutputs(active.phases[phaseId]);
      const builtinOutputs = this.phaseOutputs(builtin.phases[phaseId]);
      this.addValueDifference(details, `phases.${phaseId}.outputs`, activeOutputs, builtinOutputs);
    }

    return details;
  }

  private phaseOutputs(phase: PhaseDefinition | undefined): string[] {
    return phase?.outputs ?? [];
  }

  private addValueDifference(
    details: WorkflowDiagnosticDetail[],
    field: string,
    activeValue: unknown,
    builtinValue: unknown
  ): void {
    if (this.stableStringify(activeValue) === this.stableStringify(builtinValue)) {
      return;
    }
    details.push({
      field,
      activeValue,
      builtinValue,
    });
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.sortValue(value));
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.sortValue(item)])
      );
    }
    return value;
  }

  private createBuiltinShadowDiagnostic(
    active: ResolvedWorkflow,
    builtin: ResolvedWorkflow,
    details: WorkflowDiagnosticDetail[]
  ): WorkflowDiagnostic {
    return {
      code: 'workflow_builtin_shadow_artifact_drift',
      message: `Workflow "${active.id}" from ${active.source} shadows a built-in workflow with different artifact/output or version definitions.`,
      workflowId: active.id,
      activeSource: active.source as Exclude<ResolvedWorkflow['source'], 'builtin'>,
      activeRootDir: active.rootDir,
      builtinSource: 'builtin',
      builtinRootDir: builtin.rootDir,
      details,
    };
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

const SAFE_WORKFLOW_PHASE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function assertSafeWorkflowPhaseId(workflowId: string, phaseId: string): void {
  if (
    phaseId.length === 0 ||
    phaseId === '.' ||
    phaseId === '..' ||
    !SAFE_WORKFLOW_PHASE_ID_PATTERN.test(phaseId)
  ) {
    throw new Error(
      `Workflow ${workflowId} phase id "${phaseId}" is not safe for artifact filenames. ` +
        'Use only ASCII letters, digits, ".", "_", and "-", and do not use "." or "..".'
    );
  }
}
