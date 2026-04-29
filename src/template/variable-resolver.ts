import { slugify } from '#utils/slug.js';
import { VariableDefaultResolutionError } from '#core/errors.js';
import type { PhaseDefinition, TaskRecord, VariableDefinition, WorkflowDefinition } from '#core/types.js';

export interface ResolvedVariables {
  FEATURE_SLUG: string;
  PHASE_NUMBER: string;
  STEP_NUMBER: string;
  STEP_ID: string;
  STEP_TITLE: string;
  PHASE_SPEC_FILE: string;
  PHASE_HANDOFF_FILE: string;
  TASK_ID: string;
  TASK_TITLE: string;
  WORKFLOW_TYPE: string;
  WORKFLOW_ID: string;
  PACK_ID: string;
  PROJECT_DOC_ROOT: string;
  TASK_ROOT: string;
  TARGET_BRANCH: string;
  SOURCE_PROBLEM_FILE: string;
  CONTEXT_FILES: string;
  CONTEXT_REFS_DETAIL: string;
  SPEC_FILE: string;
  PLAN_FILE: string;
  RESULT_FILE: string;
  PR_FILE: string;
  TOTAL_SPEC_FILE: string;
  PHASE_PLAN_FILE: string;
  MASTER_SPEC_FILE: string;
  MASTER_PHASE_FILE: string;
  IMPLEMENTATION_PLAN_FILE: string;
  IMPLEMENTATION_RESULT_FILE: string;
  TEST_RESULT_FILE: string;
  PR_BODY_FILE: string;
  [key: string]: string;
}

export interface VariableResolutionOptions {
  packVariables?: Record<string, VariableDefinition>;
  workflow?: WorkflowDefinition;
  workflowVariables?: Record<string, VariableDefinition>;
}

export class VariableResolver {
  resolve(
    task: TaskRecord,
    phaseId: string,
    definition?: PhaseDefinition,
    options: VariableResolutionOptions = {}
  ): ResolvedVariables {
    const featureSlug =
      task.variables['FEATURE_SLUG'] ?? slugify(task.title);

    const stepNumber = definition?.stepNumber ?? phaseId;
    const stepId = phaseId;
    const stepTitle = definition?.stepTitle ?? definition?.title ?? phaseId;
    const phaseNumber = stepNumber;

    const isMonoSpec = task.workflowType === 'mono-spec';
    const stepFilePrefix = `${featureSlug}_step${stepNumber}_${stepId}`;
    const phaseSpecFile = isMonoSpec
      ? `docs/${featureSlug}/${stepFilePrefix}_implementation_spec.md`
      : `docs/${featureSlug}/${featureSlug}_phase${phaseNumber}_implementation_spec.md`;
    const phaseHandoffFile = isMonoSpec
      ? `docs/${featureSlug}/${stepFilePrefix}_handoff.md`
      : `docs/${featureSlug}/${featureSlug}_phase${phaseNumber}_handoff.md`;
    const projectDocRoot = task.paths.projectDocRoot;
    const defaultSpecFile = `${projectDocRoot}/spec.md`;
    const defaultPlanFile = `${projectDocRoot}/plan.md`;
    const defaultResultFile = `${projectDocRoot}/result.md`;
    const defaultPrFile = `${projectDocRoot}/pr.md`;
    const specFile = task.variables['SPEC_FILE'] ?? defaultSpecFile;
    const planFile = task.variables['PLAN_FILE'] ?? defaultPlanFile;
    const resultFile = task.variables['RESULT_FILE'] ?? defaultResultFile;
    const prFile = task.variables['PR_FILE'] ?? defaultPrFile;
    const totalSpecFile =
      task.variables['TOTAL_SPEC_FILE'] ??
      `${projectDocRoot}/${featureSlug}_total_spec.md`;
    const phasePlanFile =
      task.variables['PHASE_PLAN_FILE'] ??
      `${projectDocRoot}/${featureSlug}_phase_plan.md`;
    const contextVariables = resolveContextVariables(task);

    const baseVariables: ResolvedVariables = {
      ...task.variables,
      FEATURE_SLUG: featureSlug,
      PHASE_NUMBER: phaseNumber,
      STEP_NUMBER: stepNumber,
      STEP_ID: stepId,
      STEP_TITLE: stepTitle,
      PHASE_SPEC_FILE: phaseSpecFile,
      PHASE_HANDOFF_FILE: phaseHandoffFile,
      TASK_ID: task.id,
      TASK_TITLE: task.title,
      WORKFLOW_TYPE: task.workflowType,
      WORKFLOW_ID: options.workflow?.id ?? task.workflowType,
      PACK_ID: task.workflowPack?.id ?? 'default',
      PROJECT_DOC_ROOT: projectDocRoot,
      TASK_ROOT: task.paths.taskRoot,
      TARGET_BRANCH: task.variables['TARGET_BRANCH'] ?? 'origin/master',
      SOURCE_PROBLEM_FILE: contextVariables.SOURCE_PROBLEM_FILE,
      CONTEXT_FILES: contextVariables.CONTEXT_FILES,
      CONTEXT_REFS_DETAIL: contextVariables.CONTEXT_REFS_DETAIL,
      SPEC_FILE: specFile,
      PLAN_FILE: planFile,
      RESULT_FILE: resultFile,
      PR_FILE: prFile,
      TOTAL_SPEC_FILE: totalSpecFile,
      PHASE_PLAN_FILE: phasePlanFile,
      MASTER_SPEC_FILE:
        task.variables['MASTER_SPEC_FILE'] ??
        `${projectDocRoot}/${featureSlug}_master_spec.md`,
      MASTER_PHASE_FILE:
        task.variables['MASTER_PHASE_FILE'] ??
        `${projectDocRoot}/${featureSlug}_phase_plan.md`,
      IMPLEMENTATION_PLAN_FILE:
        task.variables['IMPLEMENTATION_PLAN_FILE'] ??
        (isMonoSpec ? planFile : `${projectDocRoot}/${featureSlug}_implementation_plan.md`),
      IMPLEMENTATION_RESULT_FILE:
        task.variables['IMPLEMENTATION_RESULT_FILE'] ??
        (isMonoSpec ? resultFile : `${projectDocRoot}/${featureSlug}_implementation_result.md`),
      TEST_RESULT_FILE:
        task.variables['TEST_RESULT_FILE'] ??
        (isMonoSpec ? resultFile : `${projectDocRoot}/${featureSlug}_test_result.md`),
      PR_BODY_FILE:
        task.variables['PR_BODY_FILE'] ??
        (isMonoSpec ? prFile : `${projectDocRoot}/${featureSlug}_pr_body.md`),
    };

    const declarative = resolveDeclarativeLayers(
      baseVariables,
      options.packVariables,
      mergeVariableDefinitions(options.workflowVariables, options.workflow?.variables),
      definition?.variables,
    );

    return {
      ...declarative,
      ...task.variables,
    };
  }
}

function mergeVariableDefinitions(
  ...layers: Array<Record<string, VariableDefinition> | undefined>
): Record<string, VariableDefinition> | undefined {
  const merged: Record<string, VariableDefinition> = {};
  for (const layer of layers) {
    if (layer) {
      Object.assign(merged, layer);
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function resolveDeclarativeLayers(
  base: ResolvedVariables,
  ...layers: Array<Record<string, VariableDefinition> | undefined>
): ResolvedVariables {
  let resolved: ResolvedVariables = { ...base };
  for (const layer of layers) {
    if (!layer) continue;
    resolved = {
      ...resolved,
      ...resolveVariableLayer(resolved, layer),
    };
  }
  return resolved;
}

function resolveVariableLayer(
  base: ResolvedVariables,
  definitions: Record<string, VariableDefinition>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const visiting: string[] = [];

  const resolveOne = (name: string): string | undefined => {
    if (name in resolved) {
      return resolved[name];
    }

    const definition = definitions[name];
    if (!definition || definition.default === undefined) {
      return undefined;
    }

    if (visiting.includes(name)) {
      throw new VariableDefaultResolutionError(
        `circular variable defaults: ${[...visiting, name].join(' -> ')}`
      );
    }

    visiting.push(name);
    const value = renderDefaultExpression(name, definition.default, {
      ...base,
      ...resolved,
    }, definitions, resolveOne);
    visiting.pop();
    resolved[name] = value;
    return value;
  };

  for (const name of Object.keys(definitions)) {
    resolveOne(name);
  }

  return resolved;
}

function renderDefaultExpression(
  variableName: string,
  expression: string,
  resolved: Record<string, string>,
  definitions: Record<string, VariableDefinition>,
  resolveOne: (name: string) => string | undefined,
): string {
  const rendered = expression.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_token, placeholder: string) => {
    if (placeholder in resolved) {
      return resolved[placeholder] ?? '';
    }

    const sameLayerValue = resolveOne(placeholder);
    if (sameLayerValue !== undefined) {
      return sameLayerValue;
    }

    if (placeholder in definitions) {
      throw new VariableDefaultResolutionError(
        `${variableName} references ${placeholder}, but ${placeholder} has no default`
      );
    }

    throw new VariableDefaultResolutionError(
      `${variableName} references unknown placeholder ${placeholder}`
    );
  });
  const unresolved = rendered.match(/\{\{[^}]+\}\}/);
  if (unresolved) {
    throw new VariableDefaultResolutionError(
      `${variableName} contains unsupported default placeholder ${unresolved[0]}`
    );
  }
  return rendered;
}

function resolveContextVariables(task: TaskRecord): Pick<
  ResolvedVariables,
  'SOURCE_PROBLEM_FILE' | 'CONTEXT_FILES' | 'CONTEXT_REFS_DETAIL'
> {
  const contextRefs = task.contextRefs ?? [];
  const contextFiles = contextRefs.length > 0
    ? contextRefs.map((ref) => `- \`${ref.path}\``).join('\n')
    : '(none)';
  const contextRefsDetail = contextRefs.length > 0
    ? contextRefs
        .map((ref) => `- \`${ref.path}\` (role: ${ref.role}, source: ${ref.source})`)
        .join('\n')
    : '(none)';

  if (contextRefs.length === 0) {
    return {
      SOURCE_PROBLEM_FILE: task.variables['SOURCE_PROBLEM_FILE'] ?? '(not provided)',
      CONTEXT_FILES: contextFiles,
      CONTEXT_REFS_DETAIL: contextRefsDetail,
    };
  }

  const sourceProblemRef = contextRefs.find((ref) => ref.role === 'source-problem');
  const stdinRef = contextRefs.find((ref) => ref.source === 'stdin');
  const sourceProblemFile =
    sourceProblemRef?.path ??
    stdinRef?.path ??
    (contextRefs.length === 1 ? contextRefs[0].path : '(multiple context refs)');

  return {
    SOURCE_PROBLEM_FILE: sourceProblemFile,
    CONTEXT_FILES: contextFiles,
    CONTEXT_REFS_DETAIL: contextRefsDetail,
  };
}
