#!/usr/bin/env bun

/**
 * Build standalone binary for @better-webhook/cli using Bun.
 *
 * Usage:
 *   bun scripts/build-binary.ts                            # Build for current platform
 *   bun scripts/build-binary.ts --target bun-darwin-arm64  # Cross-compile for specific target
 *   bun scripts/build-binary.ts --all                      # Build for all platforms
 *
 * Requires: Dashboard and CLI must be built first (pnpm build)
 */

import {
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { execSync } from "node:child_process";

type BunTarget =
  | "bun-linux-x64"
  | "bun-linux-arm64"
  | "bun-darwin-x64"
  | "bun-darwin-arm64"
  | "bun-windows-x64";

interface BuildTarget {
  bunTarget: BunTarget;
  outputName: string;
}

const ALL_TARGETS: BuildTarget[] = [
  { bunTarget: "bun-linux-x64", outputName: "better-webhook-linux-x64" },
  { bunTarget: "bun-linux-arm64", outputName: "better-webhook-linux-arm64" },
  { bunTarget: "bun-darwin-x64", outputName: "better-webhook-darwin-x64" },
  { bunTarget: "bun-darwin-arm64", outputName: "better-webhook-darwin-arm64" },
  {
    bunTarget: "bun-windows-x64",
    outputName: "better-webhook-windows-x64.exe",
  },
];

const CLI_ROOT = resolve(import.meta.dirname!, "..");
const DIST_DIR = join(CLI_ROOT, "dist");
const DASHBOARD_DIR = join(DIST_DIR, "dashboard");
const BIN_DIR = join(CLI_ROOT, "bin");

/**
 * Recursively collect all files in a directory.
 */
function collectFiles(dir: string, basePath = ""): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relativePath = basePath ? `${basePath}/${entry}` : entry;
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Get the CLI version from environment or package.json.
 */
async function getVersion(): Promise<string> {
  // Allow overriding version via environment variable (used in CI)
  if (process.env.CLI_VERSION) {
    return process.env.CLI_VERSION;
  }
  const packageJsonPath = join(CLI_ROOT, "package.json");
  const content = await readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(content);
  return pkg.version || "0.0.0";
}

/**
 * Generate a wrapper entry file that imports dashboard files with { type: "file" }.
 * This is required for Bun to embed the files into the binary.
 */
function generateWrapperEntry(
  dashboardFiles: string[],
  version: string,
): string {
  const imports: string[] = [];
  const fileMap: string[] = [];

  dashboardFiles.forEach((file, index) => {
    const varName = `__file_${index}`;
    const escapedFile = file.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    imports.push(
      `import ${varName} from "./dashboard/${escapedFile}" with { type: "file" };`,
    );
    fileMap.push(`  "dashboard/${escapedFile}": ${varName},`);
  });

  return `// Auto-generated wrapper for standalone binary
// This file embeds dashboard assets into the binary

${imports.join("\n")}

// Make embedded file paths available globally for runtime access
// This must be set BEFORE importing the CLI
globalThis.embeddedDashboardFiles = {
${fileMap.join("\n")}
};

// Import and run the CLI using dynamic import to ensure globalThis is set first
await import("./index.js");
`;
}

/**
 * Build a standalone binary for a specific target.
 */
async function buildBinary(
  target: BuildTarget,
  version: string,
): Promise<void> {
  console.log(`\nBuilding ${target.outputName}...`);

  // Collect dashboard files to embed
  const dashboardFiles = collectFiles(DASHBOARD_DIR);
  console.log(`  Embedding ${dashboardFiles.length} dashboard files`);

  // Generate wrapper entry file
  const wrapperContent = generateWrapperEntry(dashboardFiles, version);
  const wrapperPath = join(DIST_DIR, "_binary_entry.js");
  writeFileSync(wrapperPath, wrapperContent);

  const outputPath = join(BIN_DIR, target.outputName);

  // Build using bun CLI with --compile
  const cmd = [
    "bun",
    "build",
    "--compile",
    `--target=${target.bunTarget}`,
    "--minify",
    `--define`,
    `CLI_VERSION='"${version}"'`,
    `--define`,
    `STANDALONE_BINARY=true`,
    wrapperPath,
    `--outfile`,
    outputPath,
  ].join(" ");

  console.log(`  Running: ${cmd}`);

  try {
    execSync(cmd, {
      cwd: DIST_DIR,
      stdio: "inherit",
    });
    console.log(`  Output: ${outputPath}`);
  } catch (error) {
    throw new Error(`Build failed for ${target.bunTarget}`);
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      target: { type: "string", short: "t" },
      all: { type: "boolean", short: "a" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`
Usage: bun scripts/build-binary.ts [options]

Options:
  -t, --target <target>  Build for specific target (e.g., bun-darwin-arm64)
  -a, --all              Build for all platforms
  -h, --help             Show this help message

Available targets:
  ${ALL_TARGETS.map((t) => t.bunTarget).join("\n  ")}
`);
    return;
  }

  // Validate prerequisites
  if (!existsSync(DIST_DIR)) {
    console.error(
      "Error: dist/ directory not found. Run 'pnpm build:cli' first.",
    );
    process.exit(1);
  }

  if (!existsSync(DASHBOARD_DIR)) {
    console.error(
      "Error: dist/dashboard/ not found. Run 'pnpm --filter @better-webhook/dashboard build' first.",
    );
    process.exit(1);
  }

  const entrypoint = join(DIST_DIR, "index.js");
  if (!existsSync(entrypoint)) {
    console.error(
      "Error: dist/index.js not found. Run 'pnpm build:cli' first.",
    );
    process.exit(1);
  }

  // Ensure bin directory exists
  if (!existsSync(BIN_DIR)) {
    mkdirSync(BIN_DIR, { recursive: true });
  }

  const version = await getVersion();
  console.log(`Building @better-webhook/cli v${version}`);

  let targets: BuildTarget[];

  if (values.all) {
    targets = ALL_TARGETS;
  } else if (values.target) {
    const target = ALL_TARGETS.find((t) => t.bunTarget === values.target);
    if (!target) {
      console.error(`Unknown target: ${values.target}`);
      console.error(
        `Available targets: ${ALL_TARGETS.map((t) => t.bunTarget).join(", ")}`,
      );
      process.exit(1);
    }
    targets = [target];
  } else {
    // Default: build for current platform
    const platform = process.platform;
    const arch = process.arch;

    let bunTarget: BunTarget;
    if (platform === "linux" && arch === "x64") {
      bunTarget = "bun-linux-x64";
    } else if (platform === "linux" && arch === "arm64") {
      bunTarget = "bun-linux-arm64";
    } else if (platform === "darwin" && arch === "x64") {
      bunTarget = "bun-darwin-x64";
    } else if (platform === "darwin" && arch === "arm64") {
      bunTarget = "bun-darwin-arm64";
    } else if (platform === "win32" && arch === "x64") {
      bunTarget = "bun-windows-x64";
    } else {
      console.error(`Unsupported platform: ${platform}-${arch}`);
      process.exit(1);
    }

    const target = ALL_TARGETS.find((t) => t.bunTarget === bunTarget)!;
    targets = [target];
  }

  for (const target of targets) {
    await buildBinary(target, version);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
