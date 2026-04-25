import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { TemplateRenderer } from '#template/template-renderer.js';
import {
  CircularIncludeError,
  IncludePathOutsideRootError,
  UnresolvedPlaceholderError,
} from '#core/errors.js';
import { writeTextFile } from '#utils/fs.js';
import { createTempWorkspace } from '../helpers/createTempWorkspace.js';
import type { TempWorkspace } from '../helpers/createTempWorkspace.js';

let workspace: TempWorkspace;

beforeEach(async () => {
  workspace = await createTempWorkspace();
});

afterEach(async () => {
  await workspace.cleanup();
});

async function writeTemplate(ws: TempWorkspace, relativePath: string, content: string) {
  await writeTextFile(path.join(ws.dir, '.playspec', 'templates', relativePath), content);
}

async function writePlayspecFile(ws: TempWorkspace, relativePath: string, content: string) {
  await writeTextFile(path.join(ws.dir, '.playspec', relativePath), content);
}

describe('TemplateRenderer', () => {
  it('renders simple variables', async () => {
    await writeTemplate(workspace, 'test/simple.md', 'Hello {{NAME}}!');
    const renderer = new TemplateRenderer(workspace.dir);
    const result = await renderer.render('test/simple.md', { NAME: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('expands {{include:...}} directives', async () => {
    await writePlayspecFile(workspace, 'rules/global_rules.md', '## Global Rules\n- Rule 1');
    await writeTemplate(workspace, 'test/with-include.md', 'Before\n{{include:rules/global_rules.md}}\nAfter');
    const renderer = new TemplateRenderer(workspace.dir);
    const result = await renderer.render('test/with-include.md', {});
    expect(result).toContain('## Global Rules');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('throws CircularIncludeError on circular includes', async () => {
    await writeTemplate(workspace, 'test/a.md', '{{include:templates/test/b.md}}');
    await writeTemplate(workspace, 'test/b.md', '{{include:templates/test/a.md}}');
    const renderer = new TemplateRenderer(workspace.dir);
    await expect(renderer.render('test/a.md', {})).rejects.toThrow(CircularIncludeError);
  });

  it('throws UnresolvedPlaceholderError for unknown variables', async () => {
    await writeTemplate(workspace, 'test/missing-var.md', 'Hello {{UNKNOWN_VAR}}');
    const renderer = new TemplateRenderer(workspace.dir);
    await expect(renderer.render('test/missing-var.md', {})).rejects.toThrow(
      UnresolvedPlaceholderError
    );
  });

  it('throws UnresolvedPlaceholderError when rendered output still contains raw placeholders', async () => {
    await writeTemplate(workspace, 'test/output-placeholder.md', 'Hello {{VALUE}}');
    const renderer = new TemplateRenderer(workspace.dir);
    await expect(
      renderer.render('test/output-placeholder.md', { VALUE: '{{RAW_TOKEN}}' })
    ).rejects.toThrow(UnresolvedPlaceholderError);
  });

  it('rejects include paths that escape the .playspec root', async () => {
    await writeTemplate(workspace, 'test/escape.md', '{{include:../outside.md}}');
    const renderer = new TemplateRenderer(workspace.dir);
    await expect(renderer.render('test/escape.md', {})).rejects.toThrow(
      IncludePathOutsideRootError
    );
  });

  it('renders multiple variables correctly', async () => {
    await writeTemplate(
      workspace,
      'test/multi.md',
      '# Phase {{PHASE_NUMBER}} — {{TASK_TITLE}}'
    );
    const renderer = new TemplateRenderer(workspace.dir);
    const result = await renderer.render('test/multi.md', {
      PHASE_NUMBER: '3',
      TASK_TITLE: 'My Feature',
    });
    expect(result).toBe('# Phase 3 — My Feature');
  });
});
