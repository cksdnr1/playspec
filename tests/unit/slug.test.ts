import { describe, it, expect } from 'vitest';
import { slugify } from '#utils/slug.js';

describe('slugify', () => {
  it('converts simple title to slug', () => {
    expect(slugify('Feature Name')).toBe('feature_name');
  });

  it('handles multiple spaces', () => {
    expect(slugify('Hello   World')).toBe('hello_world');
  });

  it('replaces special characters with underscores', () => {
    expect(slugify('Foo-Bar/Baz')).toBe('foo_bar_baz');
  });

  it('removes leading and trailing underscores', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('lowercases everything', () => {
    expect(slugify('ABC DEF')).toBe('abc_def');
  });

  it('handles a single word', () => {
    expect(slugify('Login')).toBe('login');
  });

  it('collapses consecutive special chars into single underscore', () => {
    expect(slugify('a--b__c')).toBe('a_b_c');
  });
});
