import { TemplateNotFoundError } from '../core/errors.js';
import { readTextFile } from '../utils/fs.js';
import { getTemplatePath } from '../utils/paths.js';

export class TemplateLoader {
  constructor(private readonly workspaceRoot: string) {}

  async load(templatePath: string): Promise<string> {
    const fullPath = getTemplatePath(this.workspaceRoot, templatePath);
    try {
      return await readTextFile(fullPath);
    } catch {
      throw new TemplateNotFoundError(fullPath);
    }
  }
}
