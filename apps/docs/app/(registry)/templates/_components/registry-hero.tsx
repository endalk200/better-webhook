import type { ProviderInfo } from "@/lib/templates";
import { Database } from "lucide-react";

interface RegistryHeroProps {
  totalTemplates: number;
  providers: ProviderInfo[];
}

export function RegistryHero({ totalTemplates, providers }: RegistryHeroProps) {
  return (
    <section className="relative nb-dots-hero bg-[var(--nb-cream)] pt-8 pb-6 sm:pt-10 sm:pb-8 px-4 overflow-hidden">
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="nb-sticker nb-sticker-coral mb-4">
              <Database className="w-3.5 h-3.5" />
              <span>
                {totalTemplates} Templates / {providers.length} Providers
              </span>
            </div>

            <h1 className="font-bold text-2xl sm:text-4xl tracking-tight leading-[1.1] uppercase mb-2">
              Template <span className="nb-highlight">Registry</span>
            </h1>

            <p className="text-sm text-[var(--nb-text-muted)] max-w-lg leading-relaxed">
              Browse, download, and run webhook payload templates to test your
              handlers against real-world payloads.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <div
                key={p.slug}
                className="flex items-center gap-2 px-3 py-1.5 border-2 border-[var(--nb-border-color)] bg-[var(--nb-white)] text-xs font-bold uppercase tracking-wide"
              >
                <span
                  className="w-4 h-4 flex items-center justify-center text-[8px] font-bold border-[1.5px] border-[var(--nb-border-color)]"
                  style={{ backgroundColor: p.bgColor, color: "#fff" }}
                >
                  {p.initial}
                </span>
                <span>{p.name}</span>
                <span className="text-[var(--nb-text-muted)] font-mono text-[10px]">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
