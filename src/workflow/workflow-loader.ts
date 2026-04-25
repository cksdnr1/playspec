import { parse as parseYaml } from 'yaml';
import { WorkflowDefinitionSchema } from './workflow-schema.js';
import { WorkflowNotFoundError } from '#core/errors.js';
import type { WorkflowDefinition } from '#core/types.js';
import { readTextFile } from '#utils/fs.js';
import { getWorkflowPath } from '#utils/paths.js';

export class WorkflowLoader {
  constructor(private readonly workspaceRoot: string) {}

  async load(workflowType: string): Promise<WorkflowDefinition> {
    const filePath = getWorkflowPath(this.workspaceRoot, workflowType);
    let content: string;
    try {
      content = await readTextFile(filePath);
    } catch {
      throw new WorkflowNotFoundError(filePath);
    }
    const raw = parseYaml(content) as unknown;
    return WorkflowDefinitionSchema.parse(raw);
  }
}
