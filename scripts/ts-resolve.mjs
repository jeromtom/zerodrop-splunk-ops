/**
 * Minimal ESM resolver hook so Node's --experimental-strip-types can load the
 * DropWatch TypeScript lib (which uses extensionless relative imports, as Next's
 * bundler resolver expects). Appends `.ts` to bare relative specifiers that
 * have no extension. Zero dependencies — keeps the offline demo + test runnable
 * without installing tsx/ts-node or the full Next toolchain.
 *
 * Usage:  node --experimental-strip-types --import ./scripts/ts-resolve.mjs file.ts
 *
 * This module both (a) registers itself as a hook on import (for the parent
 * thread) and (b) exports the `resolve` hook used inside the loader thread.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

export function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[mc]?[jt]s$/.test(specifier) &&
    !/\.json$/.test(specifier)
  ) {
    const parentPath = fileURLToPath(context.parentURL);
    const candidate = pathResolve(dirname(parentPath), `${specifier}.ts`);
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
    const indexCandidate = pathResolve(dirname(parentPath), specifier, "index.ts");
    if (existsSync(indexCandidate)) {
      return nextResolve(pathToFileURL(indexCandidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}

// Self-register synchronously (in-thread hook) so `--import` installs it.
registerHooks({ resolve });
