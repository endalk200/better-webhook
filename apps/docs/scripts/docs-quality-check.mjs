import { promises as fs } from "node:fs";
import path from "node:path";

const docsRoot = process.cwd();
const docsContentRoot = path.join(docsRoot, "content", "docs");

const allowedTopLevelCommands = new Set([
  "capture",
  "captures",
  "templates",
  "--version",
  "version",
]);

const allowedCapturesSubcommands = new Set(["list", "delete", "replay"]);
const allowedTemplatesSubcommands = new Set([
  "list",
  "download",
  "delete",
  "search",
  "cache",
  "clean",
  "run",
]);

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(filePath);
      }
      return [filePath];
    }),
  );
  return files.flat();
}

function headingToSlug(rawHeading) {
  return rawHeading
    .replace(/`/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_[\]()]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractHeadings(content) {
  const headings = new Set();
  const headingRegex = /^#{1,6}\s+(.+)$/gm;

  for (const match of content.matchAll(headingRegex)) {
    const slug = headingToSlug(match[1] ?? "");
    if (slug) headings.add(slug);
  }
  return headings;
}

function routeFromMdxPath(mdxPath) {
  const relative = path.relative(docsContentRoot, mdxPath);
  const withoutExt = relative.replace(/\.mdx$/, "");
  const normalized = withoutExt === "index" ? "" : withoutExt.replace(/\/index$/, "");
  return `/docs${normalized ? `/${normalized.replace(/\\/g, "/")}` : ""}`;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function normalizeRoute(target) {
  const [pathWithQuery = "", anchor] = target.split("#");
  const [pathname] = pathWithQuery.split("?");
  const normalizedPath = pathname.replace(/\/+$/, "") || "/docs";
  return { pathname: normalizedPath, anchor: anchor ?? "" };
}

async function loadDocsRoutes() {
  const mdxFiles = (await walkFiles(docsContentRoot)).filter((file) =>
    file.endsWith(".mdx"),
  );
  const routeMap = new Map();

  for (const mdxFile of mdxFiles) {
    const content = await fs.readFile(mdxFile, "utf8");
    const route = routeFromMdxPath(mdxFile);
    routeMap.set(route, {
      file: mdxFile,
      headings: extractHeadings(content),
    });
  }

  return routeMap;
}

async function collectDocsSourceFiles() {
  const candidates = [
    path.join(docsRoot, "app"),
    path.join(docsRoot, "content"),
  ];
  const files = [];

  for (const candidate of candidates) {
    const all = await walkFiles(candidate);
    files.push(
      ...all.filter(
        (file) => file.endsWith(".mdx") || file.endsWith(".tsx") || file.endsWith(".ts"),
      ),
    );
  }

  return files;
}

function extractInternalDocsLinks(content) {
  const matches = [];
  const linkRegex = /(?<![:\w.])\/docs(?:\/[A-Za-z0-9\-_\/]*)?(?:#[A-Za-z0-9\-_]+)?/g;

  for (const match of content.matchAll(linkRegex)) {
    const value = match[0];
    const index = match.index ?? 0;
    matches.push({ value, index });
  }
  return matches;
}

function extractCliCommandMatches(content) {
  const matches = [];
  const commandRegex =
    /\bbetter-webhook\s+(capture|captures|templates|--version|version)\b[^\n\r`]*/g;
  for (const match of content.matchAll(commandRegex)) {
    const value = match[0].trim();
    const index = match.index ?? 0;
    matches.push({ value, index });
  }
  return matches;
}

function tokenizeCommand(command) {
  return command
    .split(/\s+/)
    .map((token) => token.trim().replace(/^[`"'(]+|[`"',):;]+$/g, ""))
    .filter(Boolean);
}

async function run() {
  const routeMap = await loadDocsRoutes();
  const sourceFiles = await collectDocsSourceFiles();
  const errors = [];

  for (const sourceFile of sourceFiles) {
    const content = await fs.readFile(sourceFile, "utf8");

    for (const { value, index } of extractInternalDocsLinks(content)) {
      const { pathname, anchor } = normalizeRoute(value);
      const routeEntry = routeMap.get(pathname);
      if (!routeEntry) {
        errors.push(
          `${sourceFile}:${getLineNumber(content, index)} Invalid docs route: ${value}`,
        );
        continue;
      }
      if (anchor && !routeEntry.headings.has(anchor)) {
        errors.push(
          `${sourceFile}:${getLineNumber(content, index)} Invalid docs anchor: ${value}`,
        );
      }
    }

    if (/\bcaptures\s+(show|search|save-as-template)\b/.test(content)) {
      errors.push(`${sourceFile}: contains unsupported captures subcommands`);
    }
    if (/\bbetter-webhook\s+replay\b/.test(content)) {
      errors.push(`${sourceFile}: contains unsupported top-level replay command`);
    }

    for (const { value, index } of extractCliCommandMatches(content)) {
      const tokens = tokenizeCommand(value);
      const topLevel = tokens[1];
      if (!topLevel || !allowedTopLevelCommands.has(topLevel)) {
        errors.push(
          `${sourceFile}:${getLineNumber(content, index)} Unsupported CLI command: ${value}`,
        );
        continue;
      }

      if (topLevel === "captures") {
        const subcommand = tokens[2];
        if (subcommand && !subcommand.startsWith("-") && !allowedCapturesSubcommands.has(subcommand)) {
          errors.push(
            `${sourceFile}:${getLineNumber(content, index)} Unsupported captures subcommand: ${value}`,
          );
        }
      }

      if (topLevel === "templates") {
        const subcommand = tokens[2];
        if (subcommand && !subcommand.startsWith("-") && !allowedTemplatesSubcommands.has(subcommand)) {
          errors.push(
            `${sourceFile}:${getLineNumber(content, index)} Unsupported templates subcommand: ${value}`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error("docs-quality-check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `docs-quality-check passed: ${routeMap.size} routes, ${sourceFiles.length} source files scanned.`,
  );
}

await run();
