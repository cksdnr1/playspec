import { createHash } from 'node:crypto';
import { mkdir, readdir, realpath, rm, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { Marked } from 'marked';
import { PlaySpecError } from '#core/errors.js';
import type { TaskRecord } from '#core/types.js';
import { YamlTaskStore } from '#storage/yaml-task-store.js';
import { VariableResolver } from '#template/variable-resolver.js';
import { WorkflowLoader } from '#workflow/workflow-loader.js';
import { PhaseResolver } from '#workflow/phase-resolver.js';
import { getPlayspecRoot } from '#utils/paths.js';
import { readTextFile, writeTextFile } from '#utils/fs.js';

export type ViewerArtifactType =
  | 'source'
  | 'spec'
  | 'plan'
  | 'result'
  | 'pr'
  | 'prompt'
  | 'evidence'
  | 'snapshot'
  | 'review';

export interface ViewMarkdownInput {
  file?: string;
  taskId?: string;
  artifact?: ViewerArtifactType;
  stdout?: boolean;
}

export interface ViewMarkdownResult {
  sourcePath: string;
  html: string;
  outputPath?: string;
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const TASK_TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);
const WORKFLOW_ARTIFACTS = new Set<ViewerArtifactType>(['spec', 'plan', 'result', 'pr']);

const TASK_ARTIFACT_DIRS: Partial<Record<ViewerArtifactType, string>> = {
  source: 'sources',
  prompt: 'prompts',
  evidence: 'evidence',
  snapshot: 'snapshots',
  review: 'reviews',
};

export class MarkdownViewer {
  private readonly workspaceRoot: string;
  private readonly store: YamlTaskStore;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.store = new YamlTaskStore(workspaceRoot);
  }

  async view(input: ViewMarkdownInput): Promise<ViewMarkdownResult> {
    const sourcePath = input.file
      ? await this.resolveExplicitMarkdownFile(input.file)
      : await this.resolveTaskArtifact(input.taskId, input.artifact);
    const markdown = await readTextFile(sourcePath.absolutePath);
    const html = renderHtml({
      title: path.basename(sourcePath.relativePath),
      sourcePath: sourcePath.relativePath,
      markdown,
    });

    if (input.stdout) {
      return { sourcePath: sourcePath.relativePath, html };
    }

    const outputPath = await this.writeCacheFile(sourcePath.relativePath, html);
    return { sourcePath: sourcePath.relativePath, html, outputPath };
  }

  async clearCache(): Promise<void> {
    await rm(this.getCacheRoot(), { recursive: true, force: true });
  }

  private async resolveExplicitMarkdownFile(file: string): Promise<ResolvedSourceFile> {
    const resolved = await this.resolveWorkspaceFile(file, {
      allowedExtensions: MARKDOWN_EXTENSIONS,
      description: 'Markdown file',
    });
    return resolved;
  }

  private async resolveTaskArtifact(
    taskId: string | undefined,
    artifact: ViewerArtifactType | undefined
  ): Promise<ResolvedSourceFile> {
    if (!taskId || !artifact) {
      throw new PlaySpecError(
        'View requires either a markdown path or --task with --artifact.',
        'Use `playspec view docs/file.md` or `playspec view --task <id> --artifact spec`.'
      );
    }

    const task = await this.store.getTask(taskId);
    if (WORKFLOW_ARTIFACTS.has(artifact)) {
      return this.resolveWorkflowArtifact(task, artifact);
    }

    return this.resolveTaskDirectoryArtifact(task, artifact);
  }

  private async resolveWorkflowArtifact(task: TaskRecord, artifact: ViewerArtifactType): Promise<ResolvedSourceFile> {
    const workflow = await new WorkflowLoader(this.workspaceRoot).resolve(task.workflow);
    const { phaseId, definition } = new PhaseResolver().resolveCurrentPhase(task, workflow.definition);
    const variables = new VariableResolver().resolve(task, phaseId, workflow.definition, definition);
    const declaration = workflow.definition.artifacts?.[artifact];
    const artifactPath = declaration ? renderPathValue(declaration.path, variables) : variables[`${artifact.toUpperCase()}_FILE`];
    if (!artifactPath) {
      throw new PlaySpecError(
        `Task artifact "${artifact}" is not defined by workflow "${task.workflow}".`,
        'Use `playspec view <path>` for explicit files.'
      );
    }

    return this.resolveWorkspaceFile(artifactPath, {
      allowedExtensions: MARKDOWN_EXTENSIONS,
      description: `Task artifact "${artifact}"`,
    });
  }

  private async resolveTaskDirectoryArtifact(task: TaskRecord, artifact: ViewerArtifactType): Promise<ResolvedSourceFile> {
    const relativeDir = TASK_ARTIFACT_DIRS[artifact];
    if (!relativeDir) {
      throw new PlaySpecError(`Unsupported viewer artifact: ${artifact}`);
    }

    const taskDir = path.join(task.paths.taskRoot, relativeDir);
    const files = await this.listTaskTextFiles(taskDir);
    if (files.length === 0) {
      throw new PlaySpecError(
        `No readable ${artifact} artifact found for task "${task.id}".`,
        `Expected a markdown or text file under ${taskDir}.`
      );
    }

    if (artifact === 'source' && files.length > 1) {
      throw new PlaySpecError(
        `Task "${task.id}" has multiple source files.`,
        'Use `playspec view <path>` to choose the source file explicitly.'
      );
    }

    return this.resolveWorkspaceFile(files.at(-1)!, {
      allowedExtensions: TASK_TEXT_EXTENSIONS,
      description: `Task artifact "${artifact}"`,
    });
  }

  private async listTaskTextFiles(relativeDir: string): Promise<string[]> {
    const dirPath = path.resolve(this.workspaceRoot, relativeDir);
    const relative = path.relative(this.workspaceRoot, dirPath);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new PlaySpecError(`Task artifact directory escapes workspace: ${relativeDir}`);
    }

    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const files: Array<{ relativePath: string; mtimeMs: number }> = [];
    for (const entry of entries) {
      if (!entry.isFile() && !entry.isSymbolicLink()) {
        continue;
      }
      const relativePath = path.join(relativeDir, entry.name).split(path.sep).join('/');
      const extension = path.extname(entry.name).toLowerCase();
      if (!TASK_TEXT_EXTENSIONS.has(extension)) {
        continue;
      }
      const resolved = await this.resolveWorkspaceFile(relativePath, {
        allowedExtensions: TASK_TEXT_EXTENSIONS,
        description: 'Task artifact',
      });
      const fileStat = await stat(resolved.absolutePath);
      files.push({ relativePath: resolved.relativePath, mtimeMs: fileStat.mtimeMs });
    }

    return files
      .sort((a, b) => a.mtimeMs - b.mtimeMs || a.relativePath.localeCompare(b.relativePath))
      .map((file) => file.relativePath);
  }

  private async resolveWorkspaceFile(
    file: string,
    options: { allowedExtensions: Set<string>; description: string }
  ): Promise<ResolvedSourceFile> {
    validateWorkspacePathInput(file);
    const normalized = path.normalize(file);
    const absolutePath = path.resolve(this.workspaceRoot, normalized);
    const relative = path.relative(this.workspaceRoot, absolutePath);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new PlaySpecError(`${options.description} escapes workspace: ${file}`);
    }

    const extension = path.extname(normalized).toLowerCase();
    if (!options.allowedExtensions.has(extension)) {
      throw new PlaySpecError(
        `${options.description} must be a markdown${options.allowedExtensions.has('.txt') ? ' or text' : ''} file: ${file}`
      );
    }

    let entryStat;
    try {
      entryStat = await lstat(absolutePath);
    } catch {
      throw new PlaySpecError(`${options.description} not found: ${file}`);
    }

    if (!entryStat.isFile() && !entryStat.isSymbolicLink()) {
      throw new PlaySpecError(`${options.description} is not a file: ${file}`);
    }

    const workspaceRealPath = await realpath(this.workspaceRoot);
    const realFilePath = await realpath(absolutePath);
    const realRelative = path.relative(workspaceRealPath, realFilePath);
    if (realRelative === '..' || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
      throw new PlaySpecError(`${options.description} symlink escapes workspace: ${file}`);
    }

    const realStat = await stat(realFilePath);
    if (!realStat.isFile()) {
      throw new PlaySpecError(`${options.description} is not a file: ${file}`);
    }

    return {
      absolutePath: realFilePath,
      relativePath: path.relative(this.workspaceRoot, absolutePath).split(path.sep).join('/'),
    };
  }

  private async writeCacheFile(sourcePath: string, html: string): Promise<string> {
    const cacheRoot = this.getCacheRoot();
    await mkdir(cacheRoot, { recursive: true });
    const digest = createHash('sha256').update(sourcePath).digest('hex').slice(0, 12);
    const baseName = path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.(md|markdown|txt)$/i, '');
    const outputPath = path.join(cacheRoot, `${baseName}-${digest}.html`);
    await writeTextFile(outputPath, html);
    return path.relative(this.workspaceRoot, outputPath).split(path.sep).join('/');
  }

  private getCacheRoot(): string {
    return path.join(getPlayspecRoot(this.workspaceRoot), 'viewer', 'cache');
  }
}

interface ResolvedSourceFile {
  absolutePath: string;
  relativePath: string;
}

function validateWorkspacePathInput(file: string): void {
  if (!file.trim()) {
    throw new PlaySpecError('Markdown file path is required.');
  }
  if (path.isAbsolute(file)) {
    throw new PlaySpecError(`Absolute paths are not accepted: ${file}`);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file)) {
    throw new PlaySpecError(`URLs are not workspace files: ${file}`);
  }
  if (file.includes('\0')) {
    throw new PlaySpecError('Path contains invalid bytes.');
  }
}

function renderPathValue(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_token, name: string) => variables[name.trim()] ?? '');
}

function renderHtml(input: { title: string; sourcePath: string; markdown: string }): string {
  const body = renderMarkdown(input.markdown);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; background: Canvas; color: CanvasText; }
    main { max-width: 920px; margin: 0 auto; padding: 32px 20px 56px; }
    header { border-bottom: 1px solid color-mix(in srgb, CanvasText 18%, transparent); margin-bottom: 28px; padding-bottom: 14px; }
    header p { margin: 4px 0; color: color-mix(in srgb, CanvasText 68%, transparent); font-size: 13px; }
    pre { overflow-x: auto; padding: 14px; background: color-mix(in srgb, CanvasText 8%, transparent); border-radius: 6px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); padding: 6px 8px; }
    blockquote { border-left: 4px solid color-mix(in srgb, CanvasText 22%, transparent); margin-left: 0; padding-left: 14px; color: color-mix(in srgb, CanvasText 72%, transparent); }
  </style>
</head>
<body>
  <main>
    <header>
      <p>Source: ${escapeHtml(input.sourcePath)}</p>
      <p>Generated: ${escapeHtml(new Date().toISOString())}</p>
    </header>
${body}
  </main>
</body>
</html>
`;
}

function renderMarkdown(markdown: string): string {
  const parser = new Marked({
    renderer: {
      html(html: string) {
        return escapeHtml(html);
      },
      image(href: string, title: string | null, text: string) {
        const titleText = title ? ` "${title}"` : '';
        return `<span class="image-placeholder">Image: ${escapeHtml(text)} (${escapeHtml(href)}${escapeHtml(titleText)})</span>`;
      },
      link(href: string, title: string | null | undefined, text: string) {
        if (!isSafeLinkHref(href)) {
          return escapeHtml(text);
        }
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(href)}"${titleAttr} rel="noreferrer noopener">${text}</a>`;
      },
    },
  });
  return parser.parse(markdown, { async: false }) as string;
}

function isSafeLinkHref(href: string): boolean {
  const trimmed = href.trim().toLowerCase();
  return !trimmed.startsWith('javascript:') && !trimmed.startsWith('data:') && !trimmed.startsWith('vbscript:');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
