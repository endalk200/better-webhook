"use client";

import type { ProviderInfo } from "@/lib/templates";
import { ArrowRight } from "lucide-react";

interface ProviderStepProps {
  providers: ProviderInfo[];
  onSelect: (provider: ProviderInfo) => void;
}

export function ProviderStep({ providers, onSelect }: ProviderStepProps) {
  return (
    <div className="nb-slide-in">
      <p className="text-sm text-[var(--nb-text-muted)] mb-6">
        Select the webhook provider you want to work with.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <button
            key={provider.slug}
            type="button"
            className="nb-workflow-card p-5 sm:p-6"
            onClick={() => onSelect(provider)}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="nb-provider-icon-lg"
                style={{
                  backgroundColor: provider.bgColor,
                  color: provider.textColor,
                }}
              >
                {provider.initial}
              </div>
              <div>
                <div className="font-bold text-base sm:text-lg">
                  {provider.name}
                </div>
                <div className="text-xs text-[var(--nb-text-muted)] font-mono">
                  {provider.count}{" "}
                  {provider.count === 1 ? "template" : "templates"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-widest text-[var(--nb-text-muted)]">
              Select
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
