import path from 'node:path';
import Handlebars from 'handlebars';
import { readTextFile } from '#utils/fs.js';
import { resolveContainedPath } from '#utils/contained-path.js';
import {
  CircularIncludeError,
  IncludeNotFoundError,
  IncludePathOutsideRootError,
  TemplateNotFoundError,
  UnresolvedPlaceholderError,
} from '#core/errors.js';

const INCLUDE_REGEX = /\{\{include:([^}]+)\}\}/g;
const UNRESOLVED_PLACEHOLDER_REGEX = /\{\{([^}#/^!>][^}]*)\}\}/g;

interface TemplatePlaceholder {
  name: string;
  token: string;
}

export class TemplateRenderer {
  constructor(private readonly workspaceRoot: string) {}

  private async resolveTemplatePath(templateRoot: string, templatePath: string): Promise<string> {
    if (path.isAbsolute(templatePath)) {
      throw new IncludePathOutsideRootError(templatePath, templatePath, templateRoot);
    }

    const resolvedTemplatePath = path.resolve(templateRoot, templatePath);
    const relative = path.relative(templateRoot, resolvedTemplatePath);

    if (
      relative === '..' ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new IncludePathOutsideRootError(
        templatePath,
        resolvedTemplatePath,
        templateRoot
      );
    }

    try { return await resolveContainedPath(templateRoot, templatePath); }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return resolvedTemplatePath;
      throw new IncludePathOutsideRootError(templatePath, resolvedTemplatePath, templateRoot);
    }
  }

  private findTemplatePlaceholders(content: string): TemplatePlaceholder[] {
    const placeholders: TemplatePlaceholder[] = [];

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
      placeholders.push({ name: variableName, token });
    }

    return placeholders;
  }

  private findTemplatePlaceholderNames(content: string): string[] {
    return [
      ...new Set(
        this.findTemplatePlaceholders(content).map((placeholder) => placeholder.name)
      ),
    ];
  }

  private findMissingTemplateVariables(
    content: string,
    variables: Record<string, string>
  ): string[] {
    const placeholders = new Set<string>();

    for (const placeholder of this.findTemplatePlaceholders(content)) {
      if (!(placeholder.name in variables)) {
        placeholders.add(placeholder.token);
      }
    }

    return [...placeholders];
  }

  /**
   * Recursively expand {{include:path/to/file.md}} directives.
   * Paths are relative to the selected workflow templates directory.
   */
  private async expandIncludes(
    content: string,
    currentFile: string,
    includeChain: string[],
    templateRoot: string
  ): Promise<string> {
    const matches = [...content.matchAll(INCLUDE_REGEX)];
    if (matches.length === 0) {
      return content;
    }

    let result = content;
    for (const match of matches) {
      const includePath = match[1].trim();
      const fullIncludePath = await this.resolveTemplatePath(templateRoot, includePath);

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
        [...includeChain, fullIncludePath],
        templateRoot
      );

      result = result.replace(match[0], expanded);
    }

    return result;
  }

  async discoverPlaceholderNames(
    templatePath: string,
    templateRoot: string
  ): Promise<string[]> {
    const fullTemplatePath = await this.resolveTemplatePath(templateRoot, templatePath);

    let content: string;
    try {
      content = await readTextFile(fullTemplatePath);
    } catch {
      throw new TemplateNotFoundError(fullTemplatePath);
    }

    const expanded = await this.expandIncludes(
      content,
      fullTemplatePath,
      [fullTemplatePath],
      templateRoot
    );

    return this.findTemplatePlaceholderNames(expanded);
  }

  async render(
    templatePath: string,
    variables: Record<string, string>,
    templateRoot: string
  ): Promise<string> {
    const fullTemplatePath = await this.resolveTemplatePath(templateRoot, templatePath);

    let content: string;
    try {
      content = await readTextFile(fullTemplatePath);
    } catch {
      throw new TemplateNotFoundError(fullTemplatePath);
    }

    // Step 1: expand {{include:...}} before handing to Handlebars
    const expanded = await this.expandIncludes(
      content,
      fullTemplatePath,
      [fullTemplatePath],
      templateRoot
    );

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
