import { request } from "undici";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import {
  type TemplateMetadata,
  type TemplatesIndex,
  type WebhookTemplate,
  type LocalTemplate,
  type RemoteTemplate,
  type WebhookProvider,
  type SaveAsTemplateResult,
  TemplatesIndexSchema,
  WebhookTemplateSchema,
} from "../types/index.js";

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/endalk200/better-webhook/main";
const TEMPLATES_INDEX_URL = `${GITHUB_RAW_BASE}/templates/templates.json`;

const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

function isValidTemplateId(id: string): boolean {
  if (!id || id.length > 128) return false;
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return false;
  return TEMPLATE_ID_PATTERN.test(id);
}

export class TemplateManager {
  private baseDir: string;
  private templatesDir: string;
  private cacheFile: string;
  private indexCache: TemplatesIndex | null = null;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || join(homedir(), ".better-webhook");
    this.templatesDir = join(this.baseDir, "templates");
    this.cacheFile = join(this.baseDir, "templates-cache.json");

    // Ensure directories exist
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
    if (!existsSync(this.templatesDir)) {
      mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  /**
   * Get the templates directory path
   */
  getTemplatesDir(): string {
    return this.templatesDir;
  }

  /**
   * Fetch templates index from GitHub
   */
  async fetchRemoteIndex(forceRefresh = false): Promise<TemplatesIndex> {
    // Check cache first (valid for 1 hour)
    if (!forceRefresh && this.indexCache) {
      return this.indexCache;
    }

    if (!forceRefresh && existsSync(this.cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(this.cacheFile, "utf-8"));
        const cacheAge = Date.now() - (cached.cachedAt || 0);
        if (cacheAge < 3600000) {
          // 1 hour
          this.indexCache = cached.index;
          return cached.index;
        }
      } catch {
        // Cache invalid, fetch fresh
      }
    }

    try {
      const { statusCode, body } = await request(TEMPLATES_INDEX_URL);
      if (statusCode !== 200) {
        throw new Error(`HTTP ${statusCode}`);
      }

      const text = await body.text();
      const json = JSON.parse(text);
      const index = TemplatesIndexSchema.parse(json);

      // Cache the result
      this.indexCache = index;
      writeFileSync(
        this.cacheFile,
        JSON.stringify({ index, cachedAt: Date.now() }, null, 2),
      );

      return index;
    } catch (error: any) {
      // If we have a stale cache, return it on error
      if (existsSync(this.cacheFile)) {
        try {
          const cached = JSON.parse(readFileSync(this.cacheFile, "utf-8"));
          if (cached.index) {
            this.indexCache = cached.index;
            return cached.index;
          }
        } catch {
          // Can't use cache
        }
      }
      throw new Error(`Failed to fetch templates index: ${error.message}`);
    }
  }

  /**
   * List all remote templates
   */
  async listRemoteTemplates(options?: {
    /**
     * Bypass the on-disk/in-memory cache and fetch the latest index from remote.
     */
    forceRefresh?: boolean;
  }): Promise<RemoteTemplate[]> {
    const index = await this.fetchRemoteIndex(!!options?.forceRefresh);
    const localIds = new Set(this.listLocalTemplates().map((t) => t.id));

    return index.templates.map((metadata) => ({
      metadata,
      isDownloaded: localIds.has(metadata.id),
    }));
  }

  /**
   * Download a template by ID
   */
  async downloadTemplate(templateId: string): Promise<LocalTemplate> {
    const index = await this.fetchRemoteIndex();
    const templateMeta = index.templates.find((t) => t.id === templateId);

    if (!templateMeta) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const templateUrl = `${GITHUB_RAW_BASE}/templates/${templateMeta.file}`;

    try {
      const { statusCode, body } = await request(templateUrl);
      if (statusCode !== 200) {
        throw new Error(`HTTP ${statusCode}`);
      }

      const text = await body.text();
      const json = JSON.parse(text);
      const template = WebhookTemplateSchema.parse(json);

      // Create provider subdirectory if needed
      const providerDir = join(this.templatesDir, templateMeta.provider);
      if (!existsSync(providerDir)) {
        mkdirSync(providerDir, { recursive: true });
      }

      // Save template file
      const fileName = `${templateId}.json`;
      const filePath = join(providerDir, fileName);

      const localTemplate: LocalTemplate = {
        id: templateId,
        metadata: templateMeta,
        template,
        downloadedAt: new Date().toISOString(),
        filePath,
      };

      // Save template with metadata
      const saveData = {
        ...template,
        _metadata: {
          ...templateMeta,
          downloadedAt: localTemplate.downloadedAt,
        },
      };

      writeFileSync(filePath, JSON.stringify(saveData, null, 2));

      return localTemplate;
    } catch (error: any) {
      throw new Error(
        `Failed to download template ${templateId}: ${error.message}`,
      );
    }
  }

  /**
   * List all downloaded local templates
   */
  listLocalTemplates(): LocalTemplate[] {
    const templates: LocalTemplate[] = [];

    if (!existsSync(this.templatesDir)) {
      return templates;
    }

    const scanDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
          try {
            const content = JSON.parse(readFileSync(fullPath, "utf-8"));
            const metadata = content._metadata as TemplateMetadata & {
              downloadedAt?: string;
            };

            if (metadata) {
              const { _metadata, ...templateData } = content;
              templates.push({
                id: metadata.id,
                metadata,
                template: templateData as WebhookTemplate,
                downloadedAt: metadata.downloadedAt || new Date().toISOString(),
                filePath: fullPath,
              });
            } else {
              // Legacy template without metadata
              const id = basename(entry.name, ".json");
              templates.push({
                id,
                metadata: {
                  id,
                  name: id,
                  provider: "custom",
                  event: "unknown",
                  file: entry.name,
                },
                template: content as WebhookTemplate,
                downloadedAt: new Date().toISOString(),
                filePath: fullPath,
              });
            }
          } catch {
            // Skip invalid files
          }
        }
      }
    };

    scanDir(this.templatesDir);
    return templates;
  }

  /**
   * Get a specific local template by ID
   */
  getLocalTemplate(templateId: string): LocalTemplate | null {
    const templates = this.listLocalTemplates();
    return templates.find((t) => t.id === templateId) || null;
  }

  /**
   * Delete a local template
   */
  deleteLocalTemplate(templateId: string): boolean {
    const template = this.getLocalTemplate(templateId);
    if (!template) {
      return false;
    }

    try {
      unlinkSync(template.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Search templates by name, provider, or event
   */
  async searchTemplates(query: string): Promise<{
    remote: RemoteTemplate[];
    local: LocalTemplate[];
  }> {
    const queryLower = query.toLowerCase();

    const remote = await this.listRemoteTemplates();
    const local = this.listLocalTemplates();

    const matchesMeta = (meta: TemplateMetadata): boolean => {
      return (
        meta.id.toLowerCase().includes(queryLower) ||
        meta.name.toLowerCase().includes(queryLower) ||
        meta.provider.toLowerCase().includes(queryLower) ||
        meta.event.toLowerCase().includes(queryLower) ||
        (meta.description?.toLowerCase().includes(queryLower) ?? false)
      );
    };

    return {
      remote: remote.filter((t) => matchesMeta(t.metadata)),
      local: local.filter((t) => matchesMeta(t.metadata)),
    };
  }

  /**
   * Clear the templates cache
   */
  clearCache(): void {
    this.indexCache = null;
    if (existsSync(this.cacheFile)) {
      unlinkSync(this.cacheFile);
    }
  }

  /**
   * Delete all local templates
   * @returns Number of templates deleted
   */
  deleteAllLocalTemplates(): number {
    const templates = this.listLocalTemplates();
    let deleted = 0;

    for (const template of templates) {
      try {
        unlinkSync(template.filePath);
        deleted++;
      } catch {
        // Skip files that couldn't be deleted
      }
    }

    // Clean up empty provider directories
    if (existsSync(this.templatesDir)) {
      const entries = readdirSync(this.templatesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = join(this.templatesDir, entry.name);
          try {
            const contents = readdirSync(dirPath);
            if (contents.length === 0) {
              rmdirSync(dirPath);
            }
          } catch {
            // Skip directories that couldn't be cleaned
          }
        }
      }
    }

    return deleted;
  }

  /**
   * Check if a template with the given ID already exists locally
   */
  templateExists(templateId: string): boolean {
    return this.getLocalTemplate(templateId) !== null;
  }

  /**
   * Generate a unique template ID from provider and event
   */
  private generateTemplateId(
    provider: WebhookProvider | undefined,
    event: string | undefined,
  ): string {
    const providerPart = provider || "custom";
    const eventPart = event || "webhook";
    const baseId = `${providerPart}-${eventPart}`
      .toLowerCase()
      .replace(/\s+/g, "-");

    // If base ID doesn't exist, use it
    if (!this.templateExists(baseId)) {
      return baseId;
    }

    // Otherwise, append a counter
    let counter = 1;
    while (this.templateExists(`${baseId}-${counter}`)) {
      counter++;
    }
    return `${baseId}-${counter}`;
  }

  /**
   * Save a user-created template from a captured webhook
   */
  saveUserTemplate(
    template: WebhookTemplate,
    options: {
      id?: string;
      name?: string;
      event?: string;
      description?: string;
      overwrite?: boolean;
    } = {},
  ): SaveAsTemplateResult {
    const provider = template.provider || "custom";
    const event = options.event || template.event || "webhook";
    const templateId = options.id || this.generateTemplateId(provider, event);
    const name = options.name || templateId;
    const description = options.description || template.description;

    // Validate template ID to prevent path traversal
    if (!isValidTemplateId(templateId)) {
      throw new Error(
        `Invalid template ID "${templateId}". IDs must start with alphanumeric, contain only letters, numbers, dots, underscores, and hyphens.`,
      );
    }

    // Check for conflicts unless overwrite is enabled
    if (!options.overwrite && this.templateExists(templateId)) {
      throw new Error(
        `Template with ID "${templateId}" already exists. Use --overwrite to replace it.`,
      );
    }

    // Create provider subdirectory if needed
    const providerDir = join(this.templatesDir, provider);
    if (!existsSync(providerDir)) {
      mkdirSync(providerDir, { recursive: true });
    }

    // Build the metadata
    const metadata: TemplateMetadata & { source: string; createdAt: string } = {
      id: templateId,
      name,
      provider,
      event,
      file: `${provider}/${templateId}.json`,
      description,
      source: "capture",
      createdAt: new Date().toISOString(),
    };

    // Build the full template with metadata
    const saveData = {
      ...template,
      provider,
      event,
      description,
      _metadata: metadata,
    };

    // Save template file
    const filePath = join(providerDir, `${templateId}.json`);
    writeFileSync(filePath, JSON.stringify(saveData, null, 2));

    return {
      id: templateId,
      filePath,
      template: saveData,
    };
  }
}

// Singleton instance
let instance: TemplateManager | null = null;

export function getTemplateManager(baseDir?: string): TemplateManager {
  if (!instance) {
    instance = new TemplateManager(baseDir);
  }
  return instance;
}
