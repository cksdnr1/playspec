import path from 'node:path';
import Handlebars from 'handlebars';
import { readTextFile } from '#utils/fs.js';
import {
  CircularIncludeError,
  IncludeNotFoundError,
  IncludePathOutsideRootError,
  TemplateNotFoundError,
  UnresolvedPlaceholderError,
} from '#core/errors.js';
import { getPlayspecRoot } from '#utils/paths.js';

const INCLUDE_REGEX = /\{\{include:([^}]+)\}\}/g;
const UNRESOLVED_PLACEHOLDER_REGEX = /\{\{([^}#/^!>][^}]*)\}\}/g;

export class TemplateRenderer {
  constructor(private readonly workspaceRoot: string) {}

  private resolveIncludePath(includePath: string): string {
    const playspecRoot = getPlayspecRoot(this.workspaceRoot);
    const resolvedIncludePath = path.resolve(playspecRoot, includePath);
    const relative = path.relative(playspecRoot, resolvedIncludePath);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new IncludePathOutsideRootError(
        includePath,
        resolvedIncludePath,
        playspecRoot
      );
    }

    return resolvedIncludePath;
  }

  private findMissingTemplateVariables(
    content: string,
    variables: Record<string, string>
  ): string[] {
    const placeholders = new Set<string>();

    for (const match of content.matchAll(UNRESOLVED_PLACEHOLDER_REGEX)) {
      const token = match[0];
      const body = token.slice(2, -2).trim();

      if (
        body === '' ||
        body.startsWith('include:') ||
        body.startsWith('#') ||
        body.startsWith('/') ||
        body.startsWith('!') ||
        body.startsWith('>') ||
        body === 'else'
      ) {
        continue;
      }

      const variableName = body.split(/\s+/)[0] ?? body;
      if (!(variableName in variables)) {
        placeholders.add(token);
      }
    }

    return [...placeholders];
  }

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
      const fullIncludePath = this.resolveIncludePath(includePath);

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
        throw new IncludeNotFoundError(includePath, fullIncludePath, currentFile);
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

    const missingTemplateVariables = this.findMissingTemplateVariables(
      expanded,
      variables
    );
    if (missingTemplateVariables.length > 0) {
      throw new UnresolvedPlaceholderError(
        missingTemplateVariables,
        fullTemplatePath
      );
    }

    // Step 2: compile and render with Handlebars
    const template = Handlebars.compile(expanded, { noEscape: true });
    const rendered = template(variables);

    const unresolvedBeforeRender = [...expanded.matchAll(UNRESOLVED_PLACEHOLDER_REGEX)]
      .map((match) => match[1].trim())
      .filter((key) => !(key in variables))
      .map((key) => `{{${key}}}`);

    const unresolvedAfterRender = [...rendered.matchAll(UNRESOLVED_PLACEHOLDER_REGEX)]
      .map((match) => `{{${match[1].trim()}}}`);

    const unresolved = [
      ...new Set([...unresolvedBeforeRender, ...unresolvedAfterRender]),
    ];

    if (unresolved.length > 0) {
      throw new UnresolvedPlaceholderError(unresolved, fullTemplatePath);
    }

    return rendered;
  }
}
