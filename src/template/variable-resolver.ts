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

    const declarations = {
      ...(workflow?.variables ?? {}),
      ...(definition?.variables ?? {}),
    };
    const resolvedDefaults = resolveDeclaredDefaults(
      workflow?.id ?? task.workflow,
      engineVariables,
      declarations,
      task.variables
    );

    return {
      ...engineVariables,
      ...resolvedDefaults,
      ...task.variables,
    };
  }
}

const DEFAULT_PLACEHOLDER_REGEX = /\{\{([^}#/^!>][^}]*)\}\}/g;

function resolveDeclaredDefaults(
  workflowId: string,
  engineVariables: Record<string, string>,
  declarations: Record<string, VariableDeclaration>,
  taskVariables: Record<string, string>
): Record<string, string> {
  const resolved: Record<string, string> = { ...engineVariables };
  const resolving = new Set<string>();
  const knownVariables = new Set([
    ...Object.keys(engineVariables),
    ...Object.keys(declarations),
    ...Object.keys(taskVariables),
  ]);

  const resolveOne = (name: string, chain: string[]): string | undefined => {
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
    const value = renderDefault(
      workflowId,
      name,
      declaration.default,
      (dependency) => {
        if (!knownVariables.has(dependency)) {
          throw new UnknownVariableDefaultError(workflowId, name, dependency);
        }
        return resolveOne(dependency, [...chain, name]) ?? '';
      }
    );
    resolving.delete(name);
    resolved[name] = value;
    return value;
  };

  for (const name of Object.keys(declarations)) {
    resolveOne(name, []);
  }

  return Object.fromEntries(
    Object.entries(resolved).filter(([name]) => !(name in engineVariables) || resolved[name] !== '')
  );
}

function renderDefault(
  workflowId: string,
  variableName: string,
  template: string,
  lookup: (name: string) => string
): string {
  return template.replace(DEFAULT_PLACEHOLDER_REGEX, (_token, body: string) => {
    const dependency = body.trim().split(/\s+/)[0] ?? body.trim();
    const value = lookup(dependency);
    if (value === '') {
      throw new UnknownVariableDefaultError(workflowId, variableName, dependency);
    }
    return value;
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
