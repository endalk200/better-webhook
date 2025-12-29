"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Shield,
  Sparkles,
  Layers,
  Copy,
  Check,
} from "lucide-react";

type Framework = "nextjs" | "express" | "nestjs";
type Provider = "github" | "ragie";

const frameworkCode: Record<
  Framework,
  { install: string; code: string; filename: string }
> = {
  nextjs: {
    install: "npm install @better-webhook/github @better-webhook/nextjs",
    filename: "app/api/webhooks/github/route.ts",
    code: `import { github } from "@better-webhook/github";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event("push", async (payload) => {
    // Fully typed - payload.repository, payload.commits, etc.
    console.log(\`Push to \${payload.repository.name}\`);
    console.log(\`\${payload.commits.length} commits\`);
  })
  .event("pull_request", async (payload) => {
    if (payload.action === "opened") {
      console.log(\`New PR: \${payload.pull_request.title}\`);
    }
  })
  .onError((error, context) => {
    console.error(\`Error in \${context.eventType}\`, error);
  });

export const POST = toNextJS(webhook);`,
  },
  express: {
    install: "npm install @better-webhook/github @better-webhook/express",
    filename: "src/webhooks.ts",
    code: `import express from "express";
import { github } from "@better-webhook/github";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github()
  .event("push", async (payload) => {
    console.log(\`Push to \${payload.repository.name}\`);
  })
  .event("issues", async (payload) => {
    console.log(\`Issue \${payload.action}: \${payload.issue.title}\`);
  });

// Important: use express.raw() for signature verification
app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook)
);

app.listen(3000);`,
  },
  nestjs: {
    install: "npm install @better-webhook/github @better-webhook/nestjs",
    filename: "src/webhooks.controller.ts",
    code: `import { Controller, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { github } from "@better-webhook/github";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github()
    .event("push", async (payload) => {
      console.log(\`Push to \${payload.repository.name}\`);
    })
    .event("installation", async (payload) => {
      console.log(\`App \${payload.action}\`);
    });

  @Post("github")
  async handleGitHub(@Req() req: Request, @Res() res: Response) {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}`,
  },
};

const providerInfo: Record<
  Provider,
  { name: string; events: string[]; package: string }
> = {
  github: {
    name: "GitHub",
    events: [
      "push",
      "pull_request",
      "issues",
      "installation",
      "installation_repositories",
    ],
    package: "@better-webhook/github",
  },
  ragie: {
    name: "Ragie",
    events: [
      "document_status_updated",
      "document_deleted",
      "entity_extracted",
      "connection_sync_started",
      "connection_sync_progress",
      "connection_sync_finished",
    ],
    package: "@better-webhook/ragie",
  },
};

const sdkFeatures = [
  {
    icon: Shield,
    title: "Signature Verification",
    description:
      "Automatic HMAC signature verification for all supported providers. Timing-safe comparison to prevent attacks.",
  },
  {
    icon: Sparkles,
    title: "Type-Safe Handlers",
    description:
      "Full TypeScript support with Zod schemas. Get autocomplete for every event payload property.",
  },
  {
    icon: Layers,
    title: "Framework Adapters",
    description:
      "First-class support for Next.js App Router, Express middleware, and NestJS controllers.",
  },
];

export function SDKSection() {
  const [activeFramework, setActiveFramework] = useState<Framework>("nextjs");
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const copyToClipboard = async (text: string, type: "install" | "code") => {
    await navigator.clipboard.writeText(text);
    if (type === "install") {
      setCopiedInstall(true);
      setTimeout(() => setCopiedInstall(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const current = frameworkCode[activeFramework];

  return (
    <section className="lyra-section">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="lyra-badge lyra-badge-accent mb-6">
            <span>SDK Packages</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-mono mb-4">
            <span className="text-[var(--lyra-text)]">Type-safe.</span>{" "}
            <span className="text-[var(--lyra-accent)]">Verified.</span>{" "}
            <span className="text-[var(--lyra-primary)]">Simple.</span>
          </h2>
          <p className="text-lg text-[var(--lyra-text-secondary)] max-w-2xl mx-auto">
            Build webhook handlers with full TypeScript support, automatic
            signature verification, and Zod schema validation. Works with your
            favorite framework.
          </p>
        </div>

        {/* Features Row */}
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          {sdkFeatures.map((feature) => (
            <div key={feature.title} className="lyra-feature-card text-center">
              <div className="lyra-feature-icon mx-auto">
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold font-mono text-lg mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--lyra-text-secondary)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Framework Tabs */}
        <div className="flex justify-center mb-8">
          <div className="lyra-tabs">
            {(["nextjs", "express", "nestjs"] as Framework[]).map((fw) => (
              <button
                key={fw}
                onClick={() => setActiveFramework(fw)}
                className={`lyra-tab ${activeFramework === fw ? "active" : ""}`}
              >
                {fw === "nextjs"
                  ? "Next.js"
                  : fw === "express"
                    ? "Express"
                    : "NestJS"}
              </button>
            ))}
          </div>
        </div>

        {/* Code Display */}
        <div className="space-y-4">
          {/* Install Command */}
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-3 bg-[var(--lyra-surface)] border border-[var(--lyra-border)] font-mono text-sm overflow-x-auto">
              <span className="text-[var(--lyra-accent)]">$</span>{" "}
              <span className="text-[var(--lyra-text)]">{current.install}</span>
            </code>
            <button
              onClick={() => copyToClipboard(current.install, "install")}
              className="p-3 border border-[var(--lyra-border)] bg-[var(--lyra-surface)] hover:border-[var(--lyra-primary)] transition-colors flex-shrink-0"
              title="Copy install command"
            >
              {copiedInstall ? (
                <Check className="w-4 h-4 text-[var(--lyra-accent)]" />
              ) : (
                <Copy className="w-4 h-4 text-[var(--lyra-text-muted)]" />
              )}
            </button>
          </div>

          {/* Code Block */}
          <div className="lyra-code-block">
            <div className="lyra-code-header">
              <div className="lyra-code-dot lyra-code-dot-red" />
              <div className="lyra-code-dot lyra-code-dot-yellow" />
              <div className="lyra-code-dot lyra-code-dot-green" />
              <span className="ml-3 text-xs text-[var(--lyra-text-muted)] font-mono">
                {current.filename}
              </span>
              <button
                onClick={() => copyToClipboard(current.code, "code")}
                className="ml-auto p-1.5 hover:bg-[var(--lyra-border)] transition-colors"
                title="Copy code"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-[var(--lyra-accent)]" />
                ) : (
                  <Copy className="w-4 h-4 text-[var(--lyra-text-muted)]" />
                )}
              </button>
            </div>
            <div className="lyra-code-body overflow-x-auto max-h-[500px]">
              <pre className="font-mono text-sm leading-relaxed">
                <code
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(current.code),
                  }}
                />
              </pre>
            </div>
          </div>
        </div>

        {/* Providers */}
        <div className="mt-16">
          <h3 className="text-center font-mono text-sm uppercase tracking-wider text-[var(--lyra-text-muted)] mb-6">
            Available Providers
          </h3>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {Object.entries(providerInfo).map(([key, provider]) => (
              <div key={key} className="lyra-card-glow p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-[var(--lyra-surface)] border border-[var(--lyra-accent)] flex items-center justify-center font-mono font-bold text-[var(--lyra-accent)]">
                    {provider.name[0]}
                  </div>
                  <div>
                    <h4 className="font-semibold font-mono">{provider.name}</h4>
                    <code className="text-xs text-[var(--lyra-text-muted)]">
                      {provider.package}
                    </code>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {provider.events.slice(0, 4).map((event) => (
                    <span
                      key={event}
                      className="text-xs font-mono px-2 py-0.5 bg-[var(--lyra-bg-secondary)] border border-[var(--lyra-border)] text-[var(--lyra-text-secondary)]"
                    >
                      {event}
                    </span>
                  ))}
                  {provider.events.length > 4 && (
                    <span className="text-xs font-mono px-2 py-0.5 text-[var(--lyra-text-muted)]">
                      +{provider.events.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/docs/sdk"
            className="lyra-btn lyra-btn-primary inline-flex items-center gap-2"
          >
            SDK Documentation
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function highlightCode(code: string): string {
  let result = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Strings
  result = result.replace(
    /("[^"]*"|'[^']*'|`[^`]*`)/g,
    '<span style="color: var(--lyra-warning)">$1</span>',
  );

  // Comments
  result = result.replace(
    /(\/\/.*$)/gm,
    '<span style="color: var(--lyra-text-muted)">$1</span>',
  );

  // Keywords
  const keywords = [
    "import",
    "from",
    "const",
    "async",
    "await",
    "if",
    "export",
    "return",
    "new",
  ];
  keywords.forEach((kw) => {
    const regex = new RegExp(`\\b(${kw})\\b`, "g");
    result = result.replace(
      regex,
      '<span style="color: var(--lyra-primary)">$1</span>',
    );
  });

  // Decorators (NestJS)
  result = result.replace(
    /(@\w+)/g,
    '<span style="color: var(--lyra-accent)">$1</span>',
  );

  return result;
}
