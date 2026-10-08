import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

function within(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Resolve existing ancestors as well as leaf symlinks; never trust lexical containment alone. */
export async function resolveContainedPath(root: string, input: string): Promise<string> {
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, input);
  if (!within(absoluteRoot, target)) throw new Error(`Path is outside allowed root: ${input}`);
  const canonicalRoot = await realpath(absoluteRoot);
  let ancestor = target;
  const missing: string[] = [];
  for (;;) {
    try {
      const canonical = await realpath(ancestor);
      if (!within(canonicalRoot, canonical)) throw new Error(`Path is outside allowed root through a symlink: ${input}`);
      return path.join(canonical, ...missing);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      const info = await lstat(ancestor).catch((failure: NodeJS.ErrnoException) => {
        if (failure.code !== 'ENOENT') throw failure;
        return undefined;
      });
      if (info?.isSymbolicLink()) throw new Error(`Cannot resolve dangling symlink: ${input}`);
      if (ancestor === absoluteRoot) throw error;
      missing.unshift(path.basename(ancestor));
      ancestor = path.dirname(ancestor);
    }
  }
}
