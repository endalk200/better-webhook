import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const bundlesDir = path.resolve(process.env.NPM_BUNDLES_DIR ?? "dist/cli-npm-bundles");
const publishPlanPath = path.join(bundlesDir, "publish-plan.json");
const distTag = process.env.NPM_DIST_TAG && process.env.NPM_DIST_TAG.trim()
  ? process.env.NPM_DIST_TAG.trim()
  : "latest";

const publishPlan = JSON.parse(await readFile(publishPlanPath, "utf8"));

for (const pkg of publishPlan.packages) {
  const spec = `${pkg.name}@${publishPlan.version}`;
  const view = spawnSync("npm", ["view", spec, "version", "--json"], {
    encoding: "utf8"
  });

  if (view.status === 0) {
    process.stdout.write(`Skipping ${spec}; version already exists.\n`);
    continue;
  }

  const viewStderr = `${view.stderr ?? ""}`;
  if (viewStderr && !viewStderr.includes("E404")) {
    process.stderr.write(viewStderr);
    throw new Error(`Unable to check npm package state for ${spec}`);
  }

  const args = ["publish", "--access", "public"];
  if (distTag !== "latest") {
    args.push("--tag", distTag);
  }
  if (process.env.NPM_PROVENANCE !== "0") {
    args.push("--provenance");
  }

  process.stdout.write(`Publishing ${spec} from ${pkg.directory}\n`);
  const publish = spawnSync("npm", args, {
    cwd: pkg.directory,
    stdio: "inherit",
    env: process.env
  });

  if (publish.status !== 0) {
    throw new Error(`npm publish failed for ${spec}`);
  }
}

process.stdout.write("Npm publish pipeline completed.\n");
