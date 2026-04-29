import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { WorkflowRegistry } from './workflow-registry.js';
import { WorkflowLoader } from './workflow-loader.js';

export class WorkflowInstaller {
  private readonly registry: WorkflowRegistry;

  constructor(private readonly workspaceRoot: string) {
    this.registry = new WorkflowRegistry(workspaceRoot);
  }

  async install(sourceDir: string): Promise<string> {
    const loader = new WorkflowLoader(this.workspaceRoot);
    const sourceWorkflow = await loader.resolveFromDirectory(sourceDir);
    const targetDir = path.join(this.registry.getUserRoot(), sourceWorkflow.id);
    await mkdir(this.registry.getUserRoot(), { recursive: true });
    try {
      await cp(sourceDir, targetDir, { recursive: true, errorOnExist: true, force: false });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to install workflow "${sourceWorkflow.id}": ${error.message}`);
      }
      throw error;
    }
    return sourceWorkflow.id;
  }

  async remove(workflowId: string): Promise<void> {
    await rm(path.join(this.registry.getUserRoot(), workflowId), { recursive: true, force: false });
  }

  async export(workflowId: string, outDir: string): Promise<void> {
    const workflow = await new WorkflowLoader(this.workspaceRoot).resolve(workflowId);
    await cp(workflow.rootDir, outDir, { recursive: true });
  }
}
