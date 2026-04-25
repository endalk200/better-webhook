"use client";

import { Shield, Layers, Zap, Code2, Database, Plug } from "lucide-react";

const features = [
  {
    icon: Code2,
    title: "Type-Safe Handlers",
    description:
      "Full TypeScript support with Zod schemas. Get autocomplete for every event payload property.",
    badge: "SDK",
    stripe: "nb-stripe-blue",
  },
  {
    icon: Shield,
    title: "Signature Verification",
    description:
      "Automatic signature verification for GitHub, Stripe, Ragie, Recall.ai, and Resend with timing-safe comparison.",
    badge: "SDK",
    stripe: "nb-stripe-blue",
  },
  {
    icon: Layers,
    title: "Framework Adapters",
    description:
      "First-class integrations for Next.js, Hono, Express, NestJS, and GCP Cloud Functions.",
    badge: "SDK",
    stripe: "nb-stripe-blue",
  },
  {
    icon: Database,
    title: "Replay Protection",
    description:
      "Optional duplicate detection with provider replay keys and configurable duplicate handling.",
    badge: "SDK",
    stripe: "nb-stripe-blue",
  },
  {
    icon: Zap,
    title: "Typed Event Catalogs",
    description:
      "Provider packages expose curated event definitions so handlers stay precise and discoverable.",
    badge: "SDK",
    stripe: "nb-stripe-blue",
  },
  {
    icon: Plug,
    title: "Custom Providers",
    description:
      "Define your own providers with schemas, signature verification, and event matching.",
    badge: "SDK",
    stripe: "nb-stripe-blue",
  },
];

export function Features() {
  return (
    <section className="nb-section bg-[var(--nb-white)]">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="nb-sticker nb-sticker-lavender mb-6 inline-flex">
            <span>Features</span>
          </div>
          <h2 className="font-bold text-3xl sm:text-4xl tracking-tight mb-3 uppercase">
            Everything you need for{" "}
            <span className="nb-highlight">webhook dev</span>
          </h2>
          <p className="text-base text-[var(--nb-text-muted)] max-w-2xl mx-auto">
            A focused SDK for production webhook handlers, provider events, and
            framework adapters.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`nb-card nb-stripe-left ${feature.stripe} p-5 group overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 flex items-center justify-center border-2 border-[var(--nb-border-color)] bg-[var(--nb-cream)]">
                  <feature.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-2 border-[var(--nb-border-color)] bg-[var(--nb-blue)] text-white">
                  {feature.badge}
                </span>
              </div>

              <h3 className="font-bold text-base mb-1.5 group-hover:text-[var(--nb-coral)] transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--nb-text-muted)] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
