import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI_PACKAGE_NAMES = new Set(["@better-webhook/cli", "better-webhook"]);

type PackageJsonMetadata = {
  name?: string;
};

function resolveRealPath(filePath: string): string {
  try {
    return realpathSync(filePath);
  } catch {
    return filePath;
  }
}

function readPackageName(packageJsonPath: string): string | undefined {
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, { encoding: "utf8" }),
    ) as PackageJsonMetadata;
    return typeof packageJson.name === "string" ? packageJson.name : undefined;
  } catch {
    return undefined;
  }
}

function isCliPackageName(packageName: string | undefined): boolean {
  return typeof packageName === "string" && CLI_PACKAGE_NAMES.has(packageName);
}

export function findCliPackageRoot(startDir: string): string | undefined {
  let currentDir = resolveRealPath(path.resolve(startDir));

  while (true) {
    const packageJsonPath = path.join(currentDir, "package.json");
    const packageName = readPackageName(packageJsonPath);
    if (isCliPackageName(packageName)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }

    currentDir = parentDir;
  }
}

export function resolveRuntimeDir(): string {
  if (typeof __dirname !== "undefined") {
    // eslint-disable-next-line no-undef
    return resolveRealPath(__dirname);
  }

  const moduleUrl = import.meta.url;
  if (typeof moduleUrl === "string" && moduleUrl.startsWith("file:")) {
    return path.dirname(resolveRealPath(fileURLToPath(moduleUrl)));
  }

  const entryPath = process.argv[1];
  if (entryPath) {
    const entryDir = path.dirname(resolveRealPath(path.resolve(entryPath)));
    const cliPackageRoot = findCliPackageRoot(entryDir);
    if (cliPackageRoot) {
      return cliPackageRoot;
    }
    return entryDir;
  }

  const cwdPackageRoot = findCliPackageRoot(process.cwd());
  if (cwdPackageRoot) {
    return cwdPackageRoot;
  }

  return process.cwd();
}
