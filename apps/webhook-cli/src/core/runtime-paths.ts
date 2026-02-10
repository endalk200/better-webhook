import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveRuntimeDir(): string {
  const moduleUrl = import.meta.url;
  if (typeof moduleUrl === "string" && moduleUrl.startsWith("file:")) {
    return path.dirname(fileURLToPath(moduleUrl));
  }

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
