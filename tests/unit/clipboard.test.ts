import { describe, it, expect, afterEach } from 'vitest';
import { copyToClipboard } from '#utils/clipboard.js';

afterEach(() => {
  delete process.env.PLAY_SPEC_DISABLE_CLIPBOARD;
});

describe('copyToClipboard', () => {
  it('returns ok:false and no attempted flag when disabled via env var', async () => {
    process.env.PLAY_SPEC_DISABLE_CLIPBOARD = '1';
    const result = await copyToClipboard('hello');
    expect(result.ok).toBe(false);
    expect(result.attempted).toBeUndefined();
  });

  it('result shape: ok and attempted are mutually exclusive', async () => {
    process.env.PLAY_SPEC_DISABLE_CLIPBOARD = '1';
    const result = await copyToClipboard('text');
    // ok:true and attempted:true must never both be set
    expect(result.ok && result.attempted).toBeFalsy();
  });
});
