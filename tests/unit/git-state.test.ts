import { describe, expect, it } from 'vitest';

import { parseNameStatusZ, parsePorcelain, parsePorcelainZ } from '#core/git-state.js';

describe('parsePorcelain', () => {
  it('preserves ordinary unquoted paths', () => {
    expect(parsePorcelain('?? docs/name with space.md')).toEqual([
      { code: '??', path: 'docs/name with space.md' },
    ]);
  });

  it('preserves ordinary unquoted paths containing the rename display delimiter', () => {
    expect(parsePorcelain('?? docs/source -> target.md')).toEqual([
      { code: '??', path: 'docs/source -> target.md' },
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

  it('preserves NUL-delimited paths containing the rename display delimiter', () => {
    expect(parsePorcelain('?? docs/source -> target.md\0')).toEqual([
      { code: '??', path: 'docs/source -> target.md' },
    ]);
  });

  it('preserves NUL-delimited paths with spaces and shell-sensitive characters', () => {
    expect(parsePorcelain(' M docs/name with $shell chars & spaces.md\0')).toEqual([
      { code: ' M', path: 'docs/name with $shell chars & spaces.md' },
    ]);
  });

  it('preserves NUL-delimited rename source and destination fields', () => {
    expect(parsePorcelain('R  src/new-name.ts\0src/old-name.ts\0')).toEqual([
      { code: 'R ', originalPath: 'src/old-name.ts', path: 'src/new-name.ts' },
    ]);
  });

  it('falls back to the raw token for malformed quoted paths', () => {
    expect(parsePorcelain('?? "docs/unclosed\\tname.md')).toEqual([
      { code: '??', path: '"docs/unclosed\\tname.md' },
    ]);
  });
});

describe('parsePorcelainZ', () => {
  it('preserves exact untracked paths that Git quotes in text mode', () => {
    expect(parsePorcelainZ('?? src/quote"file.ts\0')).toEqual([
      { code: '??', path: 'src/quote"file.ts' },
    ]);
  });

  it('preserves exact paths containing tabs and UTF-8 characters', () => {
    expect(parsePorcelainZ('?? docs/name\twithtab.md\0?? docs/caf\u00e9.md\0')).toEqual([
      { code: '??', path: 'docs/name\twithtab.md' },
      { code: '??', path: 'docs/caf\u00e9.md' },
    ]);
  });

  it('maps porcelain -z rename destination and source fields to path and originalPath', () => {
    expect(parsePorcelainZ('R  src/new"file.ts\0src/old"file.ts\0')).toEqual([
      { code: 'R ', originalPath: 'src/old"file.ts', path: 'src/new"file.ts' },
    ]);
  });
});

describe('parseNameStatusZ', () => {
  it('preserves exact changed paths that Git quotes in text mode', () => {
    expect(parseNameStatusZ('M\0src/quote"file.ts\0')).toEqual([
      { code: 'M', path: 'src/quote"file.ts' },
    ]);
  });

  it('maps name-status -z rename source and destination fields', () => {
    expect(parseNameStatusZ('R100\0src/old"file.ts\0src/new"file.ts\0')).toEqual([
      { code: 'R100', originalPath: 'src/old"file.ts', path: 'src/new"file.ts' },
    ]);
  });
});
