import path from "node:path";

export function resolveRuntimeDir(): string {
  if (typeof __dirname !== "undefined") {
    // eslint-disable-next-line no-undef
    return __dirname;
  }

  const entryPath = process.argv[1];
  if (entryPath) {
    return path.dirname(path.resolve(entryPath));
  }

  return process.cwd();
}
