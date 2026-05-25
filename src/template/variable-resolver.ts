import { slugify } from '#utils/slug.js';
import {
  CircularVariableDefaultError,
  UnknownVariableDefaultError,
} from '#core/errors.js';
import type { PhaseDefinition, TaskRecord, VariableDeclaration, WorkflowDefinition } from '#core/types.js';

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

export class VariableResolver {
  resolve(
    task: TaskRecord,
    phaseId: string,
    workflow?: WorkflowDefinition,
    definition?: PhaseDefinition
  ): ResolvedVariables {
    const featureSlug =
      task.variables['FEATURE_SLUG'] ?? slugify(task.title);

    const stepNumber = definition?.stepNumber ?? phaseId;
    const stepId = phaseId;
    const stepTitle = definition?.stepTitle ?? definition?.title ?? phaseId;
    const phaseNumber = stepNumber;

    const projectDocRoot = task.paths.projectDocRoot;
    const contextVariables = resolveContextVariables(task);

    const engineVariables: ResolvedVariables = {
      FEATURE_SLUG: featureSlug,
      PHASE_NUMBER: phaseNumber,
      STEP_NUMBER: stepNumber,
      STEP_ID: stepId,
      STEP_TITLE: stepTitle,
      PHASE_SPEC_FILE: '',
      PHASE_HANDOFF_FILE: '',
      TASK_ID: task.id,
      TASK_TITLE: task.title,
      WORKFLOW_TYPE: task.workflow,
      TARGET_BRANCH: 'origin/master',
      SOURCE_PROBLEM_FILE: contextVariables.SOURCE_PROBLEM_FILE,
      CONTEXT_FILES: contextVariables.CONTEXT_FILES,
      CONTEXT_REFS_DETAIL: contextVariables.CONTEXT_REFS_DETAIL,
      SPEC_FILE: '',
      PLAN_FILE: '',
      RESULT_FILE: '',
      PR_FILE: '',
      TOTAL_SPEC_FILE: '',
      PHASE_PLAN_FILE: '',
      MASTER_SPEC_FILE: '',
      MASTER_PHASE_FILE: '',
      IMPLEMENTATION_PLAN_FILE: '',
      IMPLEMENTATION_RESULT_FILE: '',
      TEST_RESULT_FILE: '',
      PR_BODY_FILE: '',
      PROJECT_DOC_ROOT: projectDocRoot,
    };

    const taskVariables = filterReservedEngineVariables(task.variables);
    const declarations = mergeVariableDeclarations(workflow?.variables, definition?.variables);
    const resolvedDefaults = resolveDeclaredDefaults(
      workflow?.id ?? task.workflow,
      engineVariables,
      declarations,
      taskVariables,
      getDemandedVariableNames(declarations, definition)
    );
    const nonEmptyTaskVariables = Object.fromEntries(
      Object.entries(taskVariables).filter(([, value]) => value !== '')
    );

    return {
      ...engineVariables,
      ...resolvedDefaults,
      ...nonEmptyTaskVariables,
    };
  }
}

const RESERVED_ENGINE_VARIABLES = new Set([
  'TASK_ID',
  'TASK_TITLE',
  'WORKFLOW_TYPE',
  'PHASE_NUMBER',
  'STEP_NUMBER',
  'STEP_ID',
  'STEP_TITLE',
]);

function filterReservedEngineVariables(
  taskVariables: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(taskVariables).filter(([name]) => !RESERVED_ENGINE_VARIABLES.has(name))
  );
}

const DEFAULT_PLACEHOLDER_REGEX = /\{\{([^}#/^!>][^}]*)\}\}/g;

function resolveDeclaredDefaults(
  workflowId: string,
  engineVariables: Record<string, string>,
  declarations: Record<string, VariableDeclaration>,
  taskVariables: Record<string, string>,
  demandedVariables: Set<string>
): Record<string, string> {
  const resolved: Record<string, string> = {
    ...engineVariables,
    ...taskVariables,
  };
  const resolving = new Set<string>();
  const knownVariables = new Set([
    ...Object.keys(engineVariables),
    ...Object.keys(declarations),
    ...Object.keys(taskVariables),
  ]);

  const resolveOne = (name: string, chain: string[], demanded: boolean): string | undefined => {
    if (name in resolved && resolved[name] !== '') {
      return resolved[name];
    }

    const declaration = declarations[name];
    if (!declaration?.default) {
      return resolved[name];
    }

    if (resolving.has(name)) {
      const cycleStart = chain.indexOf(name);
      const cycle = cycleStart >= 0 ? [...chain.slice(cycleStart), name] : [...chain, name];
      throw new CircularVariableDefaultError(workflowId, cycle);
    }

    resolving.add(name);
    let value: string;
    try {
      value = renderDefault(
        declaration.default,
        (dependency) => {
          if (!knownVariables.has(dependency)) {
            throw new UnknownVariableDefaultError(workflowId, name, dependency);
          }
          return resolveOne(dependency, [...chain, name], demanded) ?? '';
        }
      );
    } catch (error) {
      if (!demanded && error instanceof UnknownVariableDefaultError) {
        return undefined;
      }
      throw error;
    } finally {
      resolving.delete(name);
    }
    resolved[name] = value;
    return value;
  };

  for (const name of Object.keys(declarations)) {
    resolveOne(name, [], demandedVariables.has(name));
  }

  return Object.fromEntries(
    Object.entries(resolved).filter(([name]) => !(name in engineVariables) || resolved[name] !== '')
  );
}

export function mergeVariableDeclarations(
  workflowVariables?: Record<string, VariableDeclaration>,
  phaseVariables?: Record<string, VariableDeclaration>
): Record<string, VariableDeclaration> {
  const declarations: Record<string, VariableDeclaration> = { ...(workflowVariables ?? {}) };

  for (const [name, declaration] of Object.entries(phaseVariables ?? {})) {
    declarations[name] = {
      ...(declarations[name] ?? {}),
      ...declaration,
    };
  }

  return declarations;
}

function getDemandedVariableNames(
  declarations: Record<string, VariableDeclaration>,
  definition?: PhaseDefinition
): Set<string> {
  const demanded = new Set<string>();

  for (const [name, declaration] of Object.entries(declarations)) {
    if (declaration.required === true) {
      demanded.add(name);
    }
  }

  for (const name of Object.keys(definition?.variables ?? {})) {
    demanded.add(name);
  }

  for (const name of definition?.requiredVariables ?? []) {
    demanded.add(name);
  }

  for (const name of definition?.outputs ?? []) {
    demanded.add(name);
  }

  return demanded;
}

function renderDefault(
  template: string,
  lookup: (name: string) => string
): string {
  return template.replace(DEFAULT_PLACEHOLDER_REGEX, (_token, body: string) => {
    const dependency = body.trim().split(/\s+/)[0] ?? body.trim();
    return lookup(dependency);
  });
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
