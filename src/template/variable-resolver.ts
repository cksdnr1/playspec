import { slugify } from '#utils/slug.js';
import type { PhaseDefinition, TaskRecord } from '#core/types.js';

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
  MASTER_SPEC_FILE: string;
  MASTER_PHASE_FILE: string;
  IMPLEMENTATION_PLAN_FILE: string;
  IMPLEMENTATION_RESULT_FILE: string;
  TEST_RESULT_FILE: string;
  PR_BODY_FILE: string;
  [key: string]: string;
}

export class VariableResolver {
  resolve(task: TaskRecord, phaseId: string, definition?: PhaseDefinition): ResolvedVariables {
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
    const implementationPlanPrefix = `${featureSlug}_step4_implementation_plan_create`;
    const implementationResultPrefix = `${featureSlug}_step7_implementation`;
    const testResultPrefix = `${featureSlug}_step8_focused_tests`;
    const prBodyPrefix = `${featureSlug}_step10_pr_prepare`;
    const defaultImplementationPlanFile = isMonoSpec
      ? `docs/${featureSlug}/${implementationPlanPrefix}_implementation_plan.md`
      : `${projectDocRoot}/${featureSlug}_implementation_plan.md`;
    const defaultImplementationResultFile = isMonoSpec
      ? `docs/${featureSlug}/${implementationResultPrefix}_implementation_result.md`
      : `${projectDocRoot}/${featureSlug}_implementation_result.md`;
    const defaultTestResultFile = isMonoSpec
      ? `docs/${featureSlug}/${testResultPrefix}_test_result.md`
      : `${projectDocRoot}/${featureSlug}_test_result.md`;
    const defaultPrBodyFile = isMonoSpec
      ? `docs/${featureSlug}/${prBodyPrefix}_pr_body.md`
      : `${projectDocRoot}/${featureSlug}_pr_body.md`;

    return {
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
        defaultImplementationPlanFile,
      IMPLEMENTATION_RESULT_FILE:
        task.variables['IMPLEMENTATION_RESULT_FILE'] ??
        defaultImplementationResultFile,
      TEST_RESULT_FILE:
        task.variables['TEST_RESULT_FILE'] ??
        defaultTestResultFile,
      PR_BODY_FILE:
        task.variables['PR_BODY_FILE'] ??
        defaultPrBodyFile,
    };
  }
}
