import fs from "node:fs";
import path from "node:path";
import type { TemplateMetadata } from "./templates";

interface TemplateIndex {
  version: string;
  templates: TemplateMetadata[];
}

function resolveTemplatesPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "../../templates/templates.jsonc"),
    path.resolve(process.cwd(), "templates/templates.jsonc"),
  ];

  const templatesPath = candidates.find((candidate) =>
    fs.existsSync(candidate),
  );
  if (!templatesPath) {
    throw new Error(
      `Could not locate templates/templates.jsonc. Tried:\n- ${candidates.join("\n- ")}`,
    );
  }

  return templatesPath;
}

function stripJsonComments(jsonc: string): string {
  let result = "";
  let i = 0;
  let inString = false;

  while (i < jsonc.length) {
    const char = jsonc[i]!;

    if (inString) {
      result += char;
      if (char === "\\" && i + 1 < jsonc.length) {
        result += jsonc[i + 1];
        i += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      i++;
      continue;
    }

    if (char === "/" && i + 1 < jsonc.length) {
      const next = jsonc[i + 1];
      if (next === "/") {
        while (i < jsonc.length && jsonc[i] !== "\n") i++;
        continue;
      }
      if (next === "*") {
        i += 2;
        while (
          i + 1 < jsonc.length &&
          !(jsonc[i] === "*" && jsonc[i + 1] === "/")
        )
          i++;
        i += 2;
        continue;
      }
    }

    result += char;
    i++;
  }

  return result;
}

export function getTemplates(): TemplateMetadata[] {
  const templatesPath = resolveTemplatesPath();

  let raw: string;
  try {
    raw = fs.readFileSync(templatesPath, "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to read templates index at "${templatesPath}". ${String(error)}`,
    );
  }

  let index: TemplateIndex;
  try {
    index = JSON.parse(stripJsonComments(raw)) as TemplateIndex;
  } catch (error) {
    throw new Error(
      `Failed to parse templates index at "${templatesPath}". ${String(error)}`,
    );
  }

  return index.templates;
}
