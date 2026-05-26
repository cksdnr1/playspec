import { describe, expect, it } from 'vitest';

import { parsePorcelain } from '#core/git-state.js';

describe('parsePorcelain', () => {
  it('preserves ordinary unquoted paths', () => {
    expect(parsePorcelain('?? docs/name with space.md')).toEqual([
      { code: '??', path: 'docs/name with space.md' },
    ]);
  });

  it('decodes quoted porcelain path escapes', () => {
    expect(parsePorcelain('?? "docs/name\\twithtab.md"')).toEqual([
      { code: '??', path: 'docs/name\twithtab.md' },
    ]);
  });

  it('decodes quoted octal byte escapes as UTF-8', () => {
    expect(parsePorcelain('?? "docs/caf\\303\\251.md"')).toEqual([
      { code: '??', path: 'docs/caf\u00e9.md' },
    ]);
  });

  it('preserves ordinary rename source and destination fields', () => {
    expect(parsePorcelain('R  src/old-name.ts -> src/new-name.ts')).toEqual([
      { code: 'R ', originalPath: 'src/old-name.ts', path: 'src/new-name.ts' },
    ]);
  });

  it('decodes quoted rename source and destination fields', () => {
    expect(parsePorcelain('R  "docs/old\\tname.md" -> "docs/new\\tname.md"')).toEqual([
      { code: 'R ', originalPath: 'docs/old\tname.md', path: 'docs/new\tname.md' },
    ]);
  });

  it('falls back to the raw token for malformed quoted paths', () => {
    expect(parsePorcelain('?? "docs/unclosed\\tname.md')).toEqual([
      { code: '??', path: '"docs/unclosed\\tname.md' },
    ]);
  });
});
