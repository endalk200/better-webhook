import { cp, mkdir, mkdtemp, readFile, rm, chmod, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

export const CLI_RELEASE_TAG_PATTERN =
  /^cli-v(?<version>\d+\.\d+\.\d+)(?:-(?<channel>alpha|beta|rc)\.(?<iteration>\d+))?$/;

export const PLATFORM_PACKAGES = [
  {
    packageName: "@better-webhook/cli-darwin-arm64",
    directory: "packages/cli-darwin-arm64",
    platform: "darwin-arm64",
    os: "darwin",
    arch: "arm64",
    archiveName: "bw-darwin-arm64.tar.gz",
    binaryName: "bw",
  },
  {
    packageName: "@better-webhook/cli-darwin-x64",
    directory: "packages/cli-darwin-x64",
    platform: "darwin-x64",
    os: "darwin",
    arch: "x64",
    archiveName: "bw-darwin-x64.tar.gz",
    binaryName: "bw",
  },
  {
    packageName: "@better-webhook/cli-linux-arm64",
    directory: "packages/cli-linux-arm64",
    platform: "linux-arm64",
    os: "linux",
    arch: "arm64",
    archiveName: "bw-linux-arm64.tar.gz",
    binaryName: "bw",
  },
  {
    packageName: "@better-webhook/cli-linux-x64",
    directory: "packages/cli-linux-x64",
    platform: "linux-x64",
    os: "linux",
    arch: "x64",
    archiveName: "bw-linux-x64.tar.gz",
    binaryName: "bw",
  },
  {
    packageName: "@better-webhook/cli-windows-x64",
    directory: "packages/cli-windows-x64",
    platform: "windows-x64",
    os: "win32",
    arch: "x64",
    archiveName: "bw-windows-x64.zip",
    binaryName: "bw.exe",
  },
];

const WRAPPER_PACKAGE = {
  packageName: "@better-webhook/cli",
  directory: "packages/cli",
};

export function parseCliReleaseTag(tag) {
  const match = CLI_RELEASE_TAG_PATTERN.exec(tag);
  if (!match?.groups) {
    throw new Error(
      `Invalid CLI release tag "${tag}". Expected cli-v<semver> with optional -alpha.N, -beta.N, or -rc.N.`,
    );
  }

  const { version, channel, iteration } = match.groups;
  const isPrerelease = Boolean(channel);
  const resolvedVersion =
    isPrerelease && channel && iteration
      ? `${version}-${channel}.${iteration}`
      : version;

  return {
    tag,
    version: resolvedVersion,
    isPrerelease,
    npmTag: isPrerelease ? "next" : "latest",
    githubPrerelease: isPrerelease,
  };
}

export function stampManifestVersions(manifest, version) {
  const nextManifest = structuredClone(manifest);
  nextManifest.version = version;

  if (nextManifest.optionalDependencies) {
    for (const packageName of Object.keys(nextManifest.optionalDependencies)) {
      nextManifest.optionalDependencies[packageName] = version;
    }
  }

  if (nextManifest.dependencies) {
    for (const packageName of Object.keys(nextManifest.dependencies)) {
      if (packageName.startsWith("@better-webhook/cli")) {
        nextManifest.dependencies[packageName] = version;
      }
    }
  }

  return nextManifest;
}

export function parseChecksumsFile(content) {
  const checksumMap = new Map();

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const match = /^([a-fA-F0-9]+)\s+\*?(.+)$/.exec(trimmedLine);
    if (!match) {
      throw new Error(`Unable to parse checksum line: ${line}`);
    }

    checksumMap.set(match[2], match[1]);
  }

  return checksumMap;
}

export function renderHomebrewCask({ version, arm64Sha256, x64Sha256 }) {
  if (!arm64Sha256 || !x64Sha256) {
    throw new Error("Missing darwin archive checksum for Homebrew cask rendering.");
  }

  return `cask "better-webhook" do
  version "${version}"

  if Hardware::CPU.arm?
    sha256 "${arm64Sha256}"
    url "https://github.com/endalk200/better-webhook/releases/download/cli-v#{version}/bw-darwin-arm64.tar.gz"
  else
    sha256 "${x64Sha256}"
    url "https://github.com/endalk200/better-webhook/releases/download/cli-v#{version}/bw-darwin-x64.tar.gz"
  end

  name "better-webhook"
  desc "Local webhook tooling"
  homepage "https://github.com/endalk200/better-webhook"

  binary "bw"
end
`;
}

export function verifyBinaryVersion(binaryPath, expectedVersion) {
  const output = execFileSync(binaryPath, ["--version"], {
    encoding: "utf8",
  }).trim();

  if (output !== expectedVersion) {
    throw new Error(
      `Version drift detected for ${binaryPath}: expected ${expectedVersion}, got ${output}.`,
    );
  }
}

function normalizeNodePlatform(platform, arch) {
  const normalizedPlatform = platform === "win32" ? "windows" : platform;
  const normalizedArch = arch === "amd64" ? "x64" : arch;
  return `${normalizedPlatform}-${normalizedArch}`;
}

async function readJSON(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJSON(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function ensureEmptyDirectory(directoryPath) {
  await rm(directoryPath, { recursive: true, force: true });
  await mkdir(directoryPath, { recursive: true });
}

async function extractArchive(archivePath, directoryPath) {
  await mkdir(directoryPath, { recursive: true });

  if (archivePath.endsWith(".tar.gz")) {
    execFileSync("tar", ["-xzf", archivePath, "-C", directoryPath], {
      stdio: "inherit",
    });
    return;
  }

  if (archivePath.endsWith(".zip")) {
    execFileSync("unzip", ["-q", archivePath, "-d", directoryPath], {
      stdio: "inherit",
    });
    return;
  }

  throw new Error(`Unsupported archive format: ${archivePath}`);
}

async function findFile(directoryPath, fileName) {
  const entries = await readFileTree(directoryPath);
  const match = entries.find((entry) => path.basename(entry) === fileName);
  if (!match) {
    throw new Error(`Unable to find ${fileName} under ${directoryPath}.`);
  }
  return match;
}

async function readFileTree(directoryPath) {
  const result = [];
  const queue = [directoryPath];

  while (queue.length > 0) {
    const currentPath = queue.pop();
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else {
        result.push(fullPath);
      }
    }
  }

  return result;
}

async function assembleNpmPackages({ tag, artifactsDir, outputDir, verifyHostVersion = true }) {
  const metadata = parseCliReleaseTag(tag);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "bw-cli-release-"));

  try {
    await ensureEmptyDirectory(outputDir);

    const wrapperSource = path.resolve(WRAPPER_PACKAGE.directory);
    const wrapperTarget = path.join(outputDir, path.basename(WRAPPER_PACKAGE.directory));
    await cp(wrapperSource, wrapperTarget, { recursive: true });

    const wrapperManifestPath = path.join(wrapperTarget, "package.json");
    const wrapperManifest = await readJSON(wrapperManifestPath);
    await writeJSON(wrapperManifestPath, stampManifestVersions(wrapperManifest, metadata.version));

    for (const spec of PLATFORM_PACKAGES) {
      const sourceDirectory = path.resolve(spec.directory);
      const targetDirectory = path.join(outputDir, path.basename(spec.directory));
      await cp(sourceDirectory, targetDirectory, { recursive: true });

      const manifestPath = path.join(targetDirectory, "package.json");
      const manifest = await readJSON(manifestPath);
      await writeJSON(manifestPath, stampManifestVersions(manifest, metadata.version));

      const archivePath = path.resolve(artifactsDir, spec.archiveName);
      const extractionDirectory = path.join(tempRoot, spec.platform);
      await extractArchive(archivePath, extractionDirectory);

      const extractedBinary = await findFile(extractionDirectory, spec.binaryName);
      const packageBinaryDirectory = path.join(targetDirectory, "bin");
      await mkdir(packageBinaryDirectory, { recursive: true });

      const packageBinaryPath = path.join(packageBinaryDirectory, spec.binaryName);
      await cp(extractedBinary, packageBinaryPath);
      if (!spec.binaryName.endsWith(".exe")) {
        await chmod(packageBinaryPath, 0o755);
      }
    }

    const generatedManifestVersions = await Promise.all(
      [WRAPPER_PACKAGE, ...PLATFORM_PACKAGES].map(async (spec) => {
        const manifest = await readJSON(
          path.join(outputDir, path.basename(spec.directory), "package.json"),
        );
        return manifest.version;
      }),
    );

    if (!generatedManifestVersions.every((version) => version === metadata.version)) {
      throw new Error("Generated npm package versions drifted from the release tag version.");
    }

    if (verifyHostVersion) {
      const hostPlatform = normalizeNodePlatform(process.platform, process.arch);
      const hostSpec = PLATFORM_PACKAGES.find((spec) => spec.platform === hostPlatform);
      if (!hostSpec) {
        throw new Error(`No host package mapping exists for ${hostPlatform}.`);
      }

      const binaryPath = path.join(
        outputDir,
        path.basename(hostSpec.directory),
        "bin",
        hostSpec.binaryName,
      );
      verifyBinaryVersion(binaryPath, metadata.version);
    }

    return metadata;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) {
      throw new Error(`Unexpected argument: ${item}`);
    }

    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options };
}

async function runCli(argv) {
  const { command, options } = parseArgs(argv);

  if (command === "metadata") {
    const metadata = parseCliReleaseTag(String(options.tag));
    if (options.output === "github") {
      for (const [key, value] of Object.entries({
        tag: metadata.tag,
        version: metadata.version,
        is_prerelease: String(metadata.isPrerelease),
        npm_tag: metadata.npmTag,
        github_prerelease: String(metadata.githubPrerelease),
      })) {
        console.log(`${key}=${value}`);
      }
      return;
    }

    console.log(JSON.stringify(metadata, null, 2));
    return;
  }

  if (command === "assemble-npm") {
    const metadata = await assembleNpmPackages({
      tag: String(options.tag),
      artifactsDir: String(options["artifacts-dir"]),
      outputDir: String(options["output-dir"]),
      verifyHostVersion: !options["skip-host-version-check"],
    });
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }

  if (command === "render-homebrew-cask") {
    const metadata = parseCliReleaseTag(String(options.tag));
    if (metadata.isPrerelease) {
      throw new Error("Homebrew cask rendering is stable-only.");
    }

    const checksumMap = parseChecksumsFile(
      await readFile(String(options["checksums-file"]), "utf8"),
    );
    const cask = renderHomebrewCask({
      version: metadata.version,
      arm64Sha256: checksumMap.get("bw-darwin-arm64.tar.gz"),
      x64Sha256: checksumMap.get("bw-darwin-x64.tar.gz"),
    });
    await writeFile(String(options.output), cask);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
