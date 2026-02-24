import { chmod, copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const releaseTag = process.env.RELEASE_TAG;
if (!releaseTag) {
  throw new Error("RELEASE_TAG is required");
}
if (!/^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/.test(releaseTag)) {
  throw new Error(`Invalid RELEASE_TAG: ${releaseTag}`);
}

const version = releaseTag.slice(1);
const repoRoot = process.cwd();
const assetsDir = path.resolve(process.env.ASSETS_DIR ?? "dist/cli-release-assets");
const bundlesDir = path.resolve(process.env.NPM_BUNDLES_DIR ?? "dist/cli-npm-bundles");

const wrapperPackageDir = path.join(repoRoot, "packages/cli");
const platformPackages = [
  {
    name: "@better-webhook/cli-darwin-arm64",
    sourceDir: path.join(repoRoot, "packages/cli-darwin-arm64"),
    assetName: "better-webhook-darwin-arm64",
    binaryFile: "better-webhook"
  },
  {
    name: "@better-webhook/cli-darwin-x64",
    sourceDir: path.join(repoRoot, "packages/cli-darwin-x64"),
    assetName: "better-webhook-darwin-x64",
    binaryFile: "better-webhook"
  },
  {
    name: "@better-webhook/cli-linux-arm64",
    sourceDir: path.join(repoRoot, "packages/cli-linux-arm64"),
    assetName: "better-webhook-linux-arm64",
    binaryFile: "better-webhook"
  },
  {
    name: "@better-webhook/cli-linux-x64",
    sourceDir: path.join(repoRoot, "packages/cli-linux-x64"),
    assetName: "better-webhook-linux-x64",
    binaryFile: "better-webhook"
  },
  {
    name: "@better-webhook/cli-windows-x64",
    sourceDir: path.join(repoRoot, "packages/cli-windows-x64"),
    assetName: "better-webhook-windows-x64.exe",
    binaryFile: "better-webhook.exe"
  }
];

await rm(bundlesDir, { force: true, recursive: true });
await mkdir(bundlesDir, { recursive: true });

const bundleOrder = [];

for (const platformPackage of platformPackages) {
  const outDir = path.join(bundlesDir, path.basename(platformPackage.sourceDir));
  const outPackageJsonPath = path.join(outDir, "package.json");
  const outBinDir = path.join(outDir, "bin");
  const outBinaryPath = path.join(outBinDir, platformPackage.binaryFile);

  await cp(platformPackage.sourceDir, outDir, { recursive: true });
  await mkdir(outBinDir, { recursive: true });
  await copyFile(path.join(assetsDir, platformPackage.assetName), outBinaryPath);

  if (!platformPackage.binaryFile.endsWith(".exe")) {
    await chmod(outBinaryPath, 0o755);
  }

  const packageJson = JSON.parse(await readFile(outPackageJsonPath, "utf8"));
  packageJson.version = version;
  await writeFile(outPackageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  bundleOrder.push({
    name: packageJson.name,
    directory: outDir
  });
}

{
  const outDir = path.join(bundlesDir, "cli");
  const outPackageJsonPath = path.join(outDir, "package.json");
  const outWrapperBinPath = path.join(outDir, "bin/better-webhook.cjs");

  await cp(wrapperPackageDir, outDir, { recursive: true });
  await chmod(outWrapperBinPath, 0o755);

  const packageJson = JSON.parse(await readFile(outPackageJsonPath, "utf8"));
  packageJson.version = version;

  const optionalDependencies = packageJson.optionalDependencies ?? {};
  for (const platformPackage of platformPackages) {
    optionalDependencies[platformPackage.name] = version;
  }
  packageJson.optionalDependencies = optionalDependencies;

  await writeFile(outPackageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  bundleOrder.push({
    name: packageJson.name,
    directory: outDir
  });
}

const publishPlanPath = path.join(bundlesDir, "publish-plan.json");
await writeFile(
  publishPlanPath,
  `${JSON.stringify({ version, packages: bundleOrder }, null, 2)}\n`
);

process.stdout.write(`Prepared npm bundles at ${bundlesDir}\n`);
