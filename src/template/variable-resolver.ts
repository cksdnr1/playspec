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
  [key: string]: string;
}

export class VariableResolver {
  resolve(task: TaskRecord, phaseId: string): ResolvedVariables {
    const featureSlug =
      task.variables['FEATURE_SLUG'] ?? slugify(task.title);

    const phaseNumber = phaseId;

    const phaseSpecFile = `docs/${featureSlug}/${featureSlug}_phase${phaseNumber}_implementation_spec.md`;
    const phaseHandoffFile = `docs/${featureSlug}/${featureSlug}_phase${phaseNumber}_handoff.md`;

    return {
      ...task.variables,
      FEATURE_SLUG: featureSlug,
      PHASE_NUMBER: phaseNumber,
      PHASE_SPEC_FILE: phaseSpecFile,
      PHASE_HANDOFF_FILE: phaseHandoffFile,
      TASK_ID: task.id,
      TASK_TITLE: task.title,
      WORKFLOW_TYPE: task.workflowType,
    };
  }
}
