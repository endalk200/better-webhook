"use client";

import {
  Radio,
  RotateCcw,
  Shield,
  LayoutDashboard,
  Layers,
  Zap,
  FileCode,
  Code2,
} from "lucide-react";

const features = [
  {
    icon: Radio,
    title: "Live Capture",
    description:
      "Start a local server to capture incoming webhooks. View payloads in real-time via WebSocket.",
    badge: "CLI",
  },
  {
    icon: RotateCcw,
    title: "Smart Replay",
    description:
      "Replay captured webhooks to any endpoint with full header preservation. Test handlers without re-triggering events.",
    badge: "CLI",
  },
  {
    icon: Shield,
    title: "Signature Verification",
    description:
      "Automatic HMAC signature verification for GitHub and Ragie. Timing-safe comparison prevents attacks.",
    badge: "SDK",
  },
  {
    icon: Code2,
    title: "Type-Safe Handlers",
    description:
      "Full TypeScript support with Zod schemas. Get autocomplete for every event payload property.",
    badge: "SDK",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard UI",
    description:
      "Beautiful local dashboard to view captures, manage templates, and replay webhooks with a visual interface.",
    badge: "CLI",
  },
  {
    icon: Layers,
    title: "Framework Adapters",
    description:
      "First-class integrations for Next.js, Express, NestJS, and GCP Cloud Functions.",
    badge: "SDK",
  },
  {
    icon: Zap,
    title: "Auto Signatures",
    description:
      "CLI generates valid signatures when running templates. Test signature verification without manual setup.",
    badge: "CLI",
  },
  {
    icon: FileCode,
    title: "Community Templates",
    description:
      "Download and run webhook templates for GitHub and Ragie. Real payloads ready to use instantly.",
    badge: "CLI",
  },
];

export function Features() {
  return (
    <section className="lyra-section lyra-section-alt">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold font-mono mb-4">
            Everything for{" "}
            <span className="gradient-text">webhook development</span>
          </h2>
          <p className="text-lg text-[var(--lyra-text-secondary)] max-w-2xl mx-auto">
            A complete toolkit that makes working with webhooks fast,
            repeatable, and delightful. From local development to production.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div key={feature.title} className="lyra-feature-card group">
              {/* Badge */}
              <div className="flex items-center justify-between mb-4">
                <div className="lyra-feature-icon">
                  <feature.icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border ${
                    feature.badge === "CLI"
                      ? "border-[var(--lyra-primary)] text-[var(--lyra-primary)]"
                      : "border-[var(--lyra-accent)] text-[var(--lyra-accent)]"
                  }`}
                >
                  {feature.badge}
                </span>
              </div>

              {/* Content */}
              <h3 className="font-semibold font-mono text-lg mb-2 group-hover:text-[var(--lyra-primary)] transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--lyra-text-secondary)] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
