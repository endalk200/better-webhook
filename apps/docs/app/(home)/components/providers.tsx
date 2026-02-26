"use client";

import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";

const providers = [
  {
    name: "GitHub",
    status: "available" as const,
    package: "@better-webhook/github",
    events: [
      "push",
      "pull_request",
      "issues",
      "installation",
      "installation_repositories",
    ],
    bgColor: "#24292e",
    accentColor: "var(--nb-coral)",
  },
  {
    name: "Ragie",
    status: "available" as const,
    package: "@better-webhook/ragie",
    events: [
      "document_status_updated",
      "document_deleted",
      "entity_extracted",
      "connection_sync_started",
      "connection_sync_progress",
      "connection_sync_finished",
    ],
    bgColor: "#0d9488",
    accentColor: "var(--nb-green)",
  },
  {
    name: "Recall.ai",
    status: "available" as const,
    package: "@better-webhook/recall",
    events: [
      "participant_events.join",
      "transcript.data",
      "transcript.partial_data",
      "bot.joining_call",
      "bot.done",
      "bot.fatal",
    ],
    bgColor: "#4f46e5",
    accentColor: "var(--nb-blue)",
  },
  {
    name: "Custom",
    status: "available" as const,
    package: "@better-webhook/core",
    events: ["any.event", "you.define"],
    bgColor: "transparent",
    accentColor: "var(--nb-lavender)",
    isCustom: true,
  },
];

export function ProviderShowcase() {
  return (
    <section className="nb-section nb-dots bg-[var(--nb-cream)]">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-10">
          <div className="nb-sticker nb-sticker-green mb-6 inline-flex">
            <span>Providers</span>
          </div>
          <h2 className="font-bold text-3xl sm:text-4xl tracking-tight mb-3 uppercase">
            Webhook <span className="nb-highlight">Providers</span>
          </h2>
          <p className="text-base text-[var(--nb-text-muted)] max-w-2xl mx-auto">
            Pre-built providers with automatic signature verification and fully
            typed payloads. Create custom providers for any webhook source.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="nb-card relative p-4 text-center"
            >
              <div
                className="w-11 h-11 flex items-center justify-center font-bold text-lg mb-2 mx-auto border-2 border-[var(--nb-border-color)]"
                style={{
                  backgroundColor: provider.isCustom
                    ? "transparent"
                    : provider.bgColor,
                  color: provider.isCustom
                    ? "var(--nb-lavender)"
                    : "#fff",
                }}
              >
                {provider.isCustom ? "+" : provider.name[0]}
              </div>
              <p className="font-bold text-sm">
                {provider.name}
              </p>
              <div className="absolute top-2 right-2">
                <div
                  className="w-4 h-4 flex items-center justify-center"
                  style={{ color: provider.accentColor }}
                >
                  <Check className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {providers
            .filter((p) => !p.isCustom)
            .map((provider) => (
              <div key={provider.name} className="nb-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center font-bold border-2 border-[var(--nb-border-color)]"
                    style={{
                      backgroundColor: provider.bgColor,
                      color: "#fff",
                    }}
                  >
                    {provider.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">
                      {provider.name}
                    </h3>
                    <code className="text-xs text-[var(--nb-text-muted)] font-mono">
                      {provider.package}
                    </code>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--nb-text-muted)]">
                    Supported Events
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {provider.events.map((event) => (
                      <span
                        key={event}
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--nb-cream)] border border-[var(--nb-border-color)] text-[var(--nb-text-muted)]"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="mt-10 text-center space-y-3">
          <p className="text-sm text-[var(--nb-text-muted)]">
            Need a different provider?{" "}
            <span className="text-[var(--nb-text)] font-bold">
              Create custom webhooks with the core package.
            </span>
          </p>
          <Link
            href="/docs/sdk/custom-providers"
            className="nb-btn nb-btn-ghost inline-flex"
          >
            Learn about custom providers
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
