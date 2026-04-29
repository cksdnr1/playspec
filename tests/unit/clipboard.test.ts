import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest';
import clipboard from 'clipboardy';
import { execa } from 'execa';
import { copyToClipboard } from '#utils/clipboard.js';

vi.mock('clipboardy', () => ({
  default: {
    write: vi.fn(),
  },
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  });
}

function execaMock(): Mock {
  return execa as unknown as Mock;
}

function clipboardWriteMock(): Mock {
  return clipboard.write as unknown as Mock;
}

afterEach(() => {
  delete process.env.PLAY_SPEC_DISABLE_CLIPBOARD;
  vi.resetAllMocks();
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
});

describe('copyToClipboard', () => {
  beforeEach(() => {
    setPlatform('linux');
  });

  it('returns ok:false and no attempted flag when disabled via env var', async () => {
    process.env.PLAY_SPEC_DISABLE_CLIPBOARD = '1';
    const result = await copyToClipboard('hello');
    expect(result.ok).toBe(false);
    expect(result.attempted).toBeUndefined();
    expect(clipboardWriteMock()).not.toHaveBeenCalled();
    expect(execaMock()).not.toHaveBeenCalled();
  });

  it('result shape: ok and attempted are mutually exclusive', async () => {
    process.env.PLAY_SPEC_DISABLE_CLIPBOARD = '1';
    const result = await copyToClipboard('text');
    // ok:true and attempted:true must never both be set
    expect(result.ok && result.attempted).toBeFalsy();
  });

  it('attempts Linux PRIMARY after native clipboard success', async () => {
    clipboardWriteMock().mockResolvedValue(undefined);
    execaMock().mockResolvedValue(undefined);

    const result = await copyToClipboard('hello');

    expect(result).toEqual({ ok: true, method: 'native clipboard', primaryOk: true });
    expect(clipboardWriteMock()).toHaveBeenCalledWith('hello');
    expect(execaMock()).toHaveBeenCalledWith('wl-copy', ['--primary'], {
      input: 'hello',
      timeout: 1500,
    });
  });

  it('keeps native clipboard success when Linux PRIMARY tools are unavailable', async () => {
    clipboardWriteMock().mockResolvedValue(undefined);
    execaMock().mockRejectedValue(new Error('missing tool'));

    const result = await copyToClipboard('hello');

    expect(result).toEqual({ ok: true, method: 'native clipboard', primaryOk: false });
    expect(execaMock()).toHaveBeenCalledTimes(3);
  });

  it('does not attempt PRIMARY on non-Linux native clipboard success', async () => {
    setPlatform('darwin');
    clipboardWriteMock().mockResolvedValue(undefined);

    const result = await copyToClipboard('hello');

    expect(result).toEqual({ ok: true, method: 'native clipboard', primaryOk: undefined });
    expect(execaMock()).not.toHaveBeenCalled();
  });

  it('tries PRIMARY candidates in Wayland then X11 order', async () => {
    clipboardWriteMock().mockResolvedValue(undefined);
    execaMock()
      .mockRejectedValueOnce(new Error('wl-copy unavailable'))
      .mockResolvedValueOnce(undefined);

    const result = await copyToClipboard('hello');

    expect(result.primaryOk).toBe(true);
    expect(execaMock()).toHaveBeenNthCalledWith(1, 'wl-copy', ['--primary'], {
      input: 'hello',
      timeout: 1500,
    });
    expect(execaMock()).toHaveBeenNthCalledWith(2, 'xclip', ['-selection', 'primary'], {
      input: 'hello',
      timeout: 1500,
    });
  });

  it('attempts PRIMARY after fallback CLIPBOARD command succeeds', async () => {
    clipboardWriteMock().mockRejectedValue(new Error('native unavailable'));
    execaMock()
      .mockRejectedValueOnce(new Error('wl-copy clipboard unavailable'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const result = await copyToClipboard('hello');

    expect(result).toEqual({ ok: true, method: 'xclip', primaryOk: true });
    expect(execaMock()).toHaveBeenNthCalledWith(1, 'wl-copy', [], {
      input: 'hello',
      timeout: 1500,
    });
    expect(execaMock()).toHaveBeenNthCalledWith(2, 'xclip', ['-selection', 'clipboard'], {
      input: 'hello',
      timeout: 1500,
    });
    expect(execaMock()).toHaveBeenNthCalledWith(3, 'wl-copy', ['--primary'], {
      input: 'hello',
      timeout: 1500,
    });
  });

  it('does not attempt PRIMARY when fallback CLIPBOARD commands all fail', async () => {
    clipboardWriteMock().mockRejectedValue(new Error('native unavailable'));
    execaMock().mockRejectedValue(new Error('missing tool'));

    const result = await copyToClipboard('hello');
    const calls = execaMock().mock.calls;

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(3);
    expect(calls.map(([command, args]) => [command, args])).toEqual([
      ['wl-copy', []],
      ['xclip', ['-selection', 'clipboard']],
      ['xsel', ['--clipboard', '--input']],
    ]);
  });
});
