import { readFileSync } from "node:fs";
import path from "node:path";
import { findCliPackageRoot } from "./runtime-paths.js";

type PackageJsonWithVersion = {
  version?: string;
};

function readPackageVersion(packageJsonPath: string): string | undefined {
  try {
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, { encoding: "utf8" }),
    ) as PackageJsonWithVersion;

    return typeof packageJson.version === "string" && packageJson.version
      ? packageJson.version
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveRuntimePackageVersion(
  runtimeDir: string,
): string | undefined {
  const searchDirs = [runtimeDir, path.resolve(runtimeDir, "..")];
  const visitedRoots = new Set<string>();

  for (const searchDir of searchDirs) {
    const cliPackageRoot = findCliPackageRoot(searchDir);
    if (!cliPackageRoot || visitedRoots.has(cliPackageRoot)) {
      continue;
    }

    visitedRoots.add(cliPackageRoot);
    const version = readPackageVersion(
      path.join(cliPackageRoot, "package.json"),
    );
    if (version) {
      return version;
    }
  }

  return undefined;
}
