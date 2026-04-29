import { TemplateNotFoundError } from '#core/errors.js';
import { readTextFile } from '#utils/fs.js';

export class TemplateLoader {
  constructor(private readonly templateRoot: string) {}

  async load(templatePath: string): Promise<string> {
    const fullPath = `${this.templateRoot}/${templatePath}`;
    try {
      return await readTextFile(fullPath);
    } catch {
      throw new TemplateNotFoundError(fullPath);
    }
  }
}
