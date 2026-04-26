import { slugify } from '#utils/slug.js';
import type { TaskRecord } from '#core/types.js';

export interface ResolvedVariables {
  FEATURE_SLUG: string;
  PHASE_NUMBER: string;
  PHASE_SPEC_FILE: string;
  PHASE_HANDOFF_FILE: string;
  TASK_ID: string;
  TASK_TITLE: string;
  WORKFLOW_TYPE: string;
  TARGET_BRANCH: string;
  SOURCE_PROBLEM_FILE: string;
  MASTER_SPEC_FILE: string;
  MASTER_PHASE_FILE: string;
  IMPLEMENTATION_PLAN_FILE: string;
  IMPLEMENTATION_RESULT_FILE: string;
  TEST_RESULT_FILE: string;
  PR_BODY_FILE: string;
  [key: string]: string;
}

export class VariableResolver {
  resolve(task: TaskRecord, phaseId: string): ResolvedVariables {
    const featureSlug =
      task.variables['FEATURE_SLUG'] ?? slugify(task.title);

    const phaseNumber = phaseId;

    const phaseSpecFile = `docs/${featureSlug}/${featureSlug}_phase${phaseNumber}_implementation_spec.md`;
    const phaseHandoffFile = `docs/${featureSlug}/${featureSlug}_phase${phaseNumber}_handoff.md`;
    const projectDocRoot = task.paths.projectDocRoot;

    return {
      ...task.variables,
      FEATURE_SLUG: featureSlug,
      PHASE_NUMBER: phaseNumber,
      PHASE_SPEC_FILE: phaseSpecFile,
      PHASE_HANDOFF_FILE: phaseHandoffFile,
      TASK_ID: task.id,
      TASK_TITLE: task.title,
      WORKFLOW_TYPE: task.workflowType,
      TARGET_BRANCH: task.variables['TARGET_BRANCH'] ?? 'origin/master',
      SOURCE_PROBLEM_FILE: task.variables['SOURCE_PROBLEM_FILE'] ?? '(not provided)',
      MASTER_SPEC_FILE:
        task.variables['MASTER_SPEC_FILE'] ??
        `${projectDocRoot}/${featureSlug}_master_spec.md`,
      MASTER_PHASE_FILE:
        task.variables['MASTER_PHASE_FILE'] ??
        `${projectDocRoot}/${featureSlug}_phase_plan.md`,
      IMPLEMENTATION_PLAN_FILE:
        task.variables['IMPLEMENTATION_PLAN_FILE'] ??
        `${projectDocRoot}/${featureSlug}_implementation_plan.md`,
      IMPLEMENTATION_RESULT_FILE:
        task.variables['IMPLEMENTATION_RESULT_FILE'] ??
        `${projectDocRoot}/${featureSlug}_implementation_result.md`,
      TEST_RESULT_FILE:
        task.variables['TEST_RESULT_FILE'] ??
        `${projectDocRoot}/${featureSlug}_test_result.md`,
      PR_BODY_FILE:
        task.variables['PR_BODY_FILE'] ??
        `${projectDocRoot}/${featureSlug}_pr_body.md`,
    };
  }
}
