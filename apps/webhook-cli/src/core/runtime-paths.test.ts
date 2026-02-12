import { afterEach, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findCliPackageRoot } from "./runtime-paths.js";

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

describe("findCliPackageRoot", () => {
  it("finds CLI package root from nested directories", () => {
    const tempDir = createTempDir("better-webhook-runtime-paths-");
    const cliRoot = path.join(
      tempDir,
      "node_modules",
      "@better-webhook",
      "cli",
    );
    const nestedDir = path.join(cliRoot, "dist", "core");

    writePackageJson(cliRoot, {
      name: "@better-webhook/cli",
      version: "3.8.0",
    });
    mkdirSync(nestedDir, { recursive: true });

    expect(findCliPackageRoot(nestedDir)).toBe(realpathSync(cliRoot));
  });

  it("returns undefined when no matching CLI package is found", () => {
    const tempDir = createTempDir("better-webhook-runtime-paths-");
    const appRoot = path.join(tempDir, "app");
    const nestedDir = path.join(appRoot, "src", "core");

    writePackageJson(appRoot, { name: "consumer-app", version: "1.0.0" });
    mkdirSync(nestedDir, { recursive: true });

    expect(findCliPackageRoot(nestedDir)).toBeUndefined();
  });

  it("supports legacy better-webhook package name", () => {
    const tempDir = createTempDir("better-webhook-runtime-paths-");
    const cliRoot = path.join(tempDir, "legacy-cli");
    const nestedDir = path.join(cliRoot, "dist");

    writePackageJson(cliRoot, { name: "better-webhook", version: "2.0.0" });
    mkdirSync(nestedDir, { recursive: true });

    expect(findCliPackageRoot(nestedDir)).toBe(realpathSync(cliRoot));
  });
});
