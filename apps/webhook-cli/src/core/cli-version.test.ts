import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveRuntimePackageVersion } from "./cli-version.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
}

function writePackageJson(
  dirPath: string,
  metadata: { name: string; version: string },
): void {
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(path.join(dirPath, "package.json"), JSON.stringify(metadata));
}

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("resolveRuntimePackageVersion", () => {
  it("returns CLI version from the resolved package root", () => {
    const tempDir = createTempDir("better-webhook-cli-version-");
    const cliRoot = path.join(
      tempDir,
      "node_modules",
      "@better-webhook",
      "cli",
    );
    const runtimeDir = path.join(cliRoot, "dist", "core");

    writePackageJson(cliRoot, {
      name: "@better-webhook/cli",
      version: "3.8.0",
    });
    mkdirSync(runtimeDir, { recursive: true });

    expect(resolveRuntimePackageVersion(runtimeDir)).toBe("3.8.0");
  });

  it("returns undefined when package roots do not match CLI names", () => {
    const tempDir = createTempDir("better-webhook-cli-version-");
    const runtimeRoot = path.join(tempDir, "runtime");
    const runtimeDir = path.join(runtimeRoot, "dist", "core");

    writePackageJson(runtimeRoot, { name: "consumer-app", version: "1.0.0" });
    mkdirSync(runtimeDir, { recursive: true });

    expect(resolveRuntimePackageVersion(runtimeDir)).toBeUndefined();
  });
});
