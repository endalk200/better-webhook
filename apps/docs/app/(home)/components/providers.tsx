"use client";

import Link from "next/link";
import { Check, Clock, ArrowRight } from "lucide-react";

const providers = [
  {
    name: "GitHub",
    status: "available",
    package: "@better-webhook/github",
    events: [
      "push",
      "pull_request",
      "issues",
      "installation",
      "installation_repositories",
    ],
    color: "#ffffff",
    bgColor: "#24292e",
  },
  {
    name: "Ragie",
    status: "available",
    package: "@better-webhook/ragie",
    events: [
      "document_status_updated",
      "document_deleted",
      "entity_extracted",
      "connection_sync_started",
      "connection_sync_progress",
      "connection_sync_finished",
    ],
    color: "#ffffff",
    bgColor: "#0d9488",
  },
  {
    name: "Custom",
    status: "available",
    package: "@better-webhook/core",
    events: ["any.event", "you.define"],
    color: "var(--lyra-primary)",
    bgColor: "transparent",
    isCustom: true,
  },
];

export function ProviderShowcase() {
  return (
    <section className="lyra-section lyra-section-alt">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold font-mono mb-4">
            <span className="text-[var(--lyra-text)]">Webhook</span>{" "}
            <span className="gradient-text">Providers</span>
          </h2>
          <p className="text-lg text-[var(--lyra-text-secondary)] max-w-2xl mx-auto">
            Pre-built providers with automatic signature verification and fully
            typed payloads. Create custom providers for any webhook source.
          </p>
        </div>

        {/* Provider Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className={`relative p-4 border transition-all duration-150 ${
                provider.status === "available"
                  ? "bg-[var(--lyra-surface)] border-[var(--lyra-border)] hover:border-[var(--lyra-primary)]"
                  : "bg-[var(--lyra-bg-secondary)] border-dashed border-[var(--lyra-border)] opacity-60"
              }`}
            >
              {/* Provider Icon/Letter */}
              <div
                className={`w-10 h-10 flex items-center justify-center font-mono font-bold text-lg mb-3 mx-auto ${
                  provider.isCustom ? "border border-[var(--lyra-primary)]" : ""
                }`}
                style={{
                  backgroundColor: provider.isCustom
                    ? "transparent"
                    : provider.bgColor,
                  color: provider.color,
                }}
              >
                {provider.isCustom ? "+" : provider.name[0]}
              </div>

              {/* Name */}
              <p
                className={`text-sm font-mono text-center ${
                  provider.status === "coming"
                    ? "text-[var(--lyra-text-muted)]"
                    : "text-[var(--lyra-text)]"
                }`}
              >
                {provider.name}
              </p>

              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                {provider.status === "available" ? (
                  <Check className="w-3.5 h-3.5 text-[var(--lyra-accent)]" />
                ) : (
                  <Clock className="w-3 h-3 text-[var(--lyra-text-muted)]" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Available Providers Detail */}
        <div className="mt-12 grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {providers
            .filter((p) => p.status === "available" && !p.isCustom)
            .map((provider) => (
              <div key={provider.name} className="lyra-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 flex items-center justify-center font-mono font-bold"
                    style={{
                      backgroundColor: provider.bgColor,
                      color: provider.color,
                    }}
                  >
                    {provider.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold font-mono">{provider.name}</h3>
                    <code className="text-xs text-[var(--lyra-text-muted)]">
                      {provider.package}
                    </code>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-wider text-[var(--lyra-text-muted)]">
                    Supported Events
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {provider.events.map((event) => (
                      <span
                        key={event}
                        className="text-xs font-mono px-2 py-0.5 bg-[var(--lyra-bg-secondary)] border border-[var(--lyra-border)] text-[var(--lyra-text-secondary)]"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center space-y-4">
          <p className="text-[var(--lyra-text-secondary)]">
            Need a different provider?{" "}
            <span className="text-[var(--lyra-text)]">
              Create custom webhooks with the core package.
            </span>
          </p>
          <Link
            href="/docs/sdk/custom-providers"
            className="inline-flex items-center gap-2 font-mono text-sm text-[var(--lyra-primary)] hover:text-[var(--lyra-primary-dark)] transition-colors"
          >
            Learn about custom providers
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
