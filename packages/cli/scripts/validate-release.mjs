import { execFileSync } from "node:child_process";

import { npmTagForVersion, platforms, readCliPackage, tagVersion } from "./release-utils.mjs";

const packageJson = await readCliPackage();
const version = packageJson.version;
const tagName = process.env.GITHUB_REF_NAME ?? execFileSync("git", ["tag", "--points-at", "HEAD"], { encoding: "utf8" })
  .split("\n")
  .find((tag) => tag.startsWith("cli/v"));

if (!tagName) {
  throw new Error("Could not find a cli/v* tag for the current release.");
}

const versionFromTag = tagVersion(tagName);
if (versionFromTag !== version) {
  throw new Error(`Tag ${tagName} resolves to ${versionFromTag}, but package.json is ${version}.`);
}

const tagObjectType = execFileSync("git", ["cat-file", "-t", tagName], { encoding: "utf8" }).trim();
if (tagObjectType !== "tag") {
  throw new Error(`CLI release tag ${tagName} must be annotated.`);
}

execFileSync("git", ["fetch", "origin", "main", "--quiet"], { stdio: "inherit" });
execFileSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
  stdio: "inherit",
});

const publishOrder = [...platforms.map((platform) => platform.packageName), packageJson.name];
const npmTag = npmTagForVersion(version);

for (const packageName of publishOrder) {
  let exists = "";

  try {
    exists = execFileSync("npm", ["view", `${packageName}@${version}`, "version", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = error.stderr?.toString() ?? "";
    if (error.status !== 1 || !/E404|not found/i.test(stderr)) {
      throw error;
    }
  }

  if (exists.trim()) {
    throw new Error(`${packageName}@${version} already exists on npm.`);
  }
}

console.log(`Validated ${tagName} for npm dist-tag ${npmTag}.`);
console.log(`Publish order: ${publishOrder.join(", ")}`);
