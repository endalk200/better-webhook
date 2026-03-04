export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  provider: string;
  event: string;
  file: string;
  version: string;
  docsUrl: string;
}

export interface ProviderInfo {
  name: string;
  slug: string;
  count: number;
  color: string;
  bgColor: string;
  initial: string;
}

const PROVIDER_THEME: Record<
  string,
  { color: string; bgColor: string; initial: string; displayName: string }
> = {
  github: {
    color: "var(--nb-coral)",
    bgColor: "#24292e",
    initial: "G",
    displayName: "GitHub",
  },
  ragie: {
    color: "var(--nb-green)",
    bgColor: "#0d9488",
    initial: "R",
    displayName: "Ragie",
  },
  recall: {
    color: "var(--nb-blue)",
    bgColor: "#4f46e5",
    initial: "R",
    displayName: "Recall.ai",
  },
};

export function getProviderTheme(providerSlug: string) {
  return (
    PROVIDER_THEME[providerSlug] ?? {
      color: "var(--nb-text-muted)",
      bgColor: "transparent",
      initial: providerSlug[0]?.toUpperCase() ?? "?",
      displayName: providerSlug,
    }
  );
}

export function getProviders(templates: TemplateMetadata[]): ProviderInfo[] {
  const providerMap = new Map<string, number>();
  for (const t of templates) {
    providerMap.set(t.provider, (providerMap.get(t.provider) ?? 0) + 1);
  }

  return Array.from(providerMap.entries()).map(([slug, count]) => {
    const theme = PROVIDER_THEME[slug];
    return {
      name: theme?.displayName ?? slug,
      slug,
      count,
      color: theme?.color ?? "var(--nb-text-muted)",
      bgColor: theme?.bgColor ?? "transparent",
      initial: theme?.initial ?? slug[0]?.toUpperCase() ?? "?",
    };
  });
}

export interface EventGroup {
  category: string;
  templates: TemplateMetadata[];
}

export function getEventsForProvider(
  templates: TemplateMetadata[],
  providerSlug: string,
): TemplateMetadata[] {
  return templates.filter((t) => t.provider === providerSlug);
}

export function groupEventsByCategory(
  templates: TemplateMetadata[],
): EventGroup[] {
  const groups = new Map<string, TemplateMetadata[]>();

  for (const t of templates) {
    const category = t.event.includes(".")
      ? (t.event.split(".")[0] ?? t.event)
      : t.event;
    const existing = groups.get(category) ?? [];
    existing.push(t);
    groups.set(category, existing);
  }

  return Array.from(groups.entries()).map(([category, items]) => ({
    category,
    templates: items,
  }));
}
