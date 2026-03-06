import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const baseRef = process.env.CHANGESET_BASE_REF || "main";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    error: result.error,
  };
}

function fail(message, details = []) {
  console.error(`::error::${message}`);

  for (const detail of details) {
    console.error(detail);
  }

  process.exit(1);
}

function getChangedFiles() {
  const result = run("git", ["diff", "--name-only", `${baseRef}...HEAD`]);

  if (result.status !== 0) {
    fail(`Failed to diff against base ref '${baseRef}'.`, [result.stderr]);
  }

  return result.stdout ? result.stdout.split("\n").filter(Boolean) : [];
}

function getChangedChangesetFiles() {
  const result = run("git", [
    "diff",
    "--name-only",
    "--diff-filter=AMR",
    `${baseRef}...HEAD`,
    "--",
    ".changeset",
  ]);

  if (result.status !== 0) {
    fail(`Failed to inspect changesets against base ref '${baseRef}'.`, [
      result.stderr,
    ]);
  }

  return result.stdout
    ? result.stdout
        .split("\n")
        .filter(Boolean)
        .filter((file) => file.startsWith(".changeset/"))
        .filter((file) => file.endsWith(".md"))
        .filter((file) => file !== ".changeset/README.md")
    : [];
}

function getChangedPublishablePackages(changedFiles) {
  const packageMap = new Map();

  for (const file of changedFiles) {
    if (!file.startsWith("packages/")) {
      continue;
    }

    const segments = file.split("/");
    if (segments.length < 2) {
      continue;
    }

    const packageDir = path.join(segments[0], segments[1]);
    const packageJsonPath = path.join(repoRoot, packageDir, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    if (packageMap.has(packageDir)) {
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    if (packageJson.private === true) {
      continue;
    }

    packageMap.set(packageDir, {
      name: packageJson.name || packageDir,
      dir: packageDir,
    });
  }

  return [...packageMap.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function validateChangesetStatus() {
  const tempFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "better-webhook-changeset-")),
    "status.json",
  );

  const result = run("pnpm", [
    "exec",
    "changeset",
    "status",
    "--output",
    tempFile,
    "--since",
    baseRef,
  ]);

  if (result.status !== 0) {
    const details = [];

    if (result.stderr) {
      details.push(result.stderr);
    }

    fail("Changeset validation failed.", details);
  }

  try {
    const status = JSON.parse(fs.readFileSync(tempFile, "utf8"));
    return Array.isArray(status.releases) ? status.releases : [];
  } catch (error) {
    fail("Failed to parse changeset status JSON.", [String(error)]);
  }
}

const changedFiles = getChangedFiles();
const changedPublishablePackages = getChangedPublishablePackages(changedFiles);

if (changedPublishablePackages.length === 0) {
  console.log(
    "No publishable packages changed; skipping changeset requirement.",
  );
  process.exit(0);
}

const changedChangesetFiles = getChangedChangesetFiles();

if (changedChangesetFiles.length === 0) {
  fail("Publishable packages changed but this PR does not add a changeset.", [
    `Changed publishable packages: ${changedPublishablePackages.map((pkg) => pkg.name).join(", ")}`,
    "Add one with 'pnpm changeset' for a release, or 'pnpm changeset --empty' if no release is needed.",
    "Manual version bumps or CHANGELOG edits do not satisfy this check.",
  ]);
}

const releases = validateChangesetStatus();

if (releases.length === 0) {
  console.log(
    "Changeset files found and validated. No release changes are planned for this PR.",
  );
  console.log(
    `Changed publishable packages: ${changedPublishablePackages.map((pkg) => pkg.name).join(", ")}`,
  );
  process.exit(0);
}

console.log("Changeset files found and validated.");
console.log(
  `Changed publishable packages: ${changedPublishablePackages.map((pkg) => pkg.name).join(", ")}`,
);
console.log(
  `Planned releases: ${releases.map((release) => release.name).join(", ")}`,
);
