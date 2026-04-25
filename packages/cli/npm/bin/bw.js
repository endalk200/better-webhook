#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { binaryName, packageNameForPlatform } from "../platform.js";

const require = createRequire(import.meta.url);
const platformPackage = packageNameForPlatform();
let platformPackageRoot;

try {
  platformPackageRoot = dirname(
    require.resolve(`${platformPackage}/package.json`),
  );
} catch {
  console.error(
    `Could not resolve better-webhook CLI package for ${process.platform}-${process.arch}. ` +
      `Expected optional dependency ${platformPackage} to be installed.`,
  );
  process.exit(1);
}

const binary = join(platformPackageRoot, "bin", binaryName());

if (!existsSync(binary)) {
  console.error(
    `Could not find better-webhook CLI binary for ${process.platform}-${process.arch}. ` +
      `Expected ${platformPackage} to provide ${binary}.`,
  );
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
