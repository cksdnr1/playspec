import path from 'node:path';
import Handlebars from 'handlebars';
import { readTextFile } from '#utils/fs.js';
import { CircularIncludeError, TemplateNotFoundError, UnresolvedPlaceholderError } from '#core/errors.js';

const INCLUDE_REGEX = /\{\{include:([^}]+)\}\}/g;

export class TemplateRenderer {
  constructor(private readonly workspaceRoot: string) {}

  /**
   * Recursively expand {{include:path/to/file.md}} directives.
   * Paths are relative to .playspec/ directory.
   */
  private async expandIncludes(
    content: string,
    currentFile: string,
    includeChain: string[]
  ): Promise<string> {
    const matches = [...content.matchAll(INCLUDE_REGEX)];
    if (matches.length === 0) {
      return content;
    }

    let result = content;
    for (const match of matches) {
      const includePath = match[1].trim();
      const fullIncludePath = path.join(this.workspaceRoot, '.playspec', includePath);

      if (includeChain.includes(fullIncludePath)) {
        throw new CircularIncludeError(includePath, [
          ...includeChain,
          fullIncludePath,
        ]);
      }

      let includeContent: string;
      try {
        includeContent = await readTextFile(fullIncludePath);
      } catch {
        throw new TemplateNotFoundError(fullIncludePath);
      }

      const expanded = await this.expandIncludes(
        includeContent,
        fullIncludePath,
        [...includeChain, fullIncludePath]
      );

      result = result.replace(match[0], expanded);
    }

    return result;
  }

  async render(
    templatePath: string,
    variables: Record<string, string>
  ): Promise<string> {
    const fullTemplatePath = path.join(
      this.workspaceRoot,
      '.playspec',
      'templates',
      templatePath
    );

    let content: string;
    try {
      content = await readTextFile(fullTemplatePath);
    } catch {
      throw new TemplateNotFoundError(fullTemplatePath);
    }

    // Step 1: expand {{include:...}} before handing to Handlebars
    const expanded = await this.expandIncludes(content, fullTemplatePath, [
      fullTemplatePath,
    ]);

    // Step 2: compile and render with Handlebars
    const template = Handlebars.compile(expanded, { noEscape: true });
    const rendered = template(variables);

    // Step 3: check for unresolved {{...}} placeholders
    // Handlebars leaves unknown variables as empty string in non-strict mode,
    // so we check the original expanded content for placeholders not in variables.
    const unresolvedMatches = [...expanded.matchAll(/\{\{([^}#/^!>][^}]*)\}\}/g)];
    const unresolved: string[] = [];
    for (const m of unresolvedMatches) {
      const key = m[1].trim();
      // Skip Handlebars block helpers (e.g. #if, /if, etc.) — already filtered by regex
      if (!(key in variables)) {
        unresolved.push(`{{${key}}}`);
      }
    }

    if (unresolved.length > 0) {
      throw new UnresolvedPlaceholderError(unresolved);
    }

    return rendered;
  }
}
