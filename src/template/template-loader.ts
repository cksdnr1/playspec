import path from 'node:path';
import { TemplateNotFoundError } from '#core/errors.js';
import { readTextFile } from '#utils/fs.js';
import { getTemplatePath } from '#utils/paths.js';

export class TemplateLoader {
  constructor(
    private readonly workspaceRoot: string,
    private readonly templateRoot?: string
  ) {}

  async load(templatePath: string): Promise<string> {
    const fullPath = this.templateRoot
      ? path.join(this.templateRoot, templatePath)
      : getTemplatePath(this.workspaceRoot, templatePath);
    try {
      return await readTextFile(fullPath);
    } catch {
      throw new TemplateNotFoundError(fullPath);
    }
  }
}
