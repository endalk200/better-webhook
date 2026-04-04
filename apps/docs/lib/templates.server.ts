import fs from "node:fs";
import path from "node:path";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
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
    const errors: ParseError[] = [];
    const parsed = parse(raw, errors, {
      allowTrailingComma: true,
      disallowComments: false,
    });

    if (errors.length > 0) {
      throw new Error(
        errors.map((error) => printParseErrorCode(error.error)).join(", "),
      );
    }

    index = parsed as TemplateIndex;
  } catch (error) {
    throw new Error(
      `Failed to parse templates index at "${templatesPath}". ${String(error)}`,
    );
  }

  return index.templates;
}
