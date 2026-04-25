import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { platforms, readCliPackage } from "./release-utils.mjs";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distRoot = join(packageRoot, "dist", "npm");
const binaryRoot = process.argv.find((arg, index) => index > 1 && arg !== "--") ?? join(packageRoot, "dist", "binaries");
const packageJson = await readCliPackage();
const readme = await readFile(join(packageRoot, "README.md"), "utf8");
const license = await readFile(join(packageRoot, "LICENSE"), "utf8");

async function findBinary(platform) {
  const direct = join(binaryRoot, `${platform.goos}_${platform.goarch}`, platform.binaryName);
  try {
    await readFile(direct);
    return direct;
  } catch {
    const entries = await readdir(binaryRoot, { withFileTypes: true });
    const binaryDir = entries.find(
      (entry) =>
        entry.isDirectory() &&
        entry.name.includes(`_${platform.goos}_`) &&
        entry.name.includes(`_${platform.goarch}`),
    );

    if (!binaryDir) {
      throw new Error(`Could not find GoReleaser binary directory for ${platform.goos}/${platform.goarch} in ${binaryRoot}.`);
    }

    return join(binaryRoot, binaryDir.name, platform.binaryName);
  }
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });

for (const platform of platforms) {
  const packageDir = join(distRoot, platform.packageName.replace("@better-webhook/", ""));
  const binDir = join(packageDir, "bin");
  const sourceBinary = await findBinary(platform);

  await mkdir(binDir, { recursive: true });
  await cp(sourceBinary, join(binDir, platform.binaryName));
  await writeFile(join(packageDir, "README.md"), readme);
  await writeFile(join(packageDir, "LICENSE"), license);
  await writeFile(
    join(packageDir, "package.json"),
    `${JSON.stringify(
      {
        name: platform.packageName,
        version: packageJson.version,
        description: `Native better-webhook CLI binary for ${platform.nodePlatform} ${platform.nodeArch}`,
        license: packageJson.license,
        repository: packageJson.repository,
        os: [platform.nodePlatform],
        cpu: [platform.nodeArch],
        files: ["bin", "README.md", "LICENSE"],
        publishConfig: packageJson.publishConfig,
      },
      null,
      2,
    )}\n`,
  );
}

const wrapperDir = join(distRoot, "cli");
await mkdir(join(wrapperDir, "npm", "bin"), { recursive: true });
await cp(join(packageRoot, "npm"), join(wrapperDir, "npm"), { recursive: true });
await writeFile(join(wrapperDir, "README.md"), readme);
await writeFile(join(wrapperDir, "LICENSE"), license);
await writeFile(
  join(wrapperDir, "package.json"),
  `${JSON.stringify(
    {
      ...packageJson,
      scripts: undefined,
      devDependencies: undefined,
    },
    null,
    2,
  )}\n`,
);

console.log(`Created npm package directories in ${distRoot}:`);
for (const entry of [...platforms.map((platform) => platform.packageName), packageJson.name]) {
  console.log(`- ${basename(entry)}`);
}
