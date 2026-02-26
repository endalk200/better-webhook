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

type Framework = "nextjs" | "hono" | "express" | "nestjs" | "gcp-functions";

const frameworkCode: Record<
  Framework,
  { install: string; code: string; filename: string }
> = {
  nextjs: {
    install: "npm install @better-webhook/github @better-webhook/nextjs",
    filename: "app/api/webhooks/github/route.ts",
    code: `import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event(push, async (payload) => {
    console.log(\`Push to \${payload.repository.name}\`);
    console.log(\`\${payload.commits.length} commits\`);
  })
  .event(pull_request, async (payload) => {
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
import { push, issues } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github()
  .event(push, async (payload) => {
    console.log(\`Push to \${payload.repository.name}\`);
  })
  .event(issues, async (payload) => {
    console.log(\`Issue \${payload.action}: \${payload.issue.title}\`);
  });

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook)
);

app.listen(3000);`,
  },
  hono: {
    install: "npm install @better-webhook/github @better-webhook/hono",
    filename: "src/webhooks.ts",
    code: `import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toHono } from "@better-webhook/hono";

const app = new Hono();

const webhook = github()
  .event(push, async (payload) => {
    console.log(\`Push to \${payload.repository.name}\`);
  });

app.post("/webhooks/github", toHono(webhook));

export default app;`,
  },
  nestjs: {
    install: "npm install @better-webhook/github @better-webhook/nestjs",
    filename: "src/webhooks.controller.ts",
    code: `import { Controller, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { github } from "@better-webhook/github";
import { push, installation } from "@better-webhook/github/events";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github()
    .event(push, async (payload) => {
      console.log(\`Push to \${payload.repository.name}\`);
    })
    .event(installation, async (payload) => {
      console.log(\`App \${payload.action}\`);
    });

  @Post("github")
  async handleGitHub(@Req() req: Request, @Res() res: Response) {
    const result = await toNestJS(this.webhook)(req);
    if (result.body) {
      return res.status(result.statusCode).json(result.body);
    }
    return res.status(result.statusCode).end();
  }
}`,
  },
  "gcp-functions": {
    install: "npm install @better-webhook/ragie @better-webhook/gcp-functions",
    filename: "index.ts",
    code: `import { http } from "@google-cloud/functions-framework";
import { ragie } from "@better-webhook/ragie";
import {
  document_status_updated,
  connection_sync_finished,
} from "@better-webhook/ragie/events";
import { toGCPFunction } from "@better-webhook/gcp-functions";

const webhook = ragie()
  .event(document_status_updated, async (payload) => {
    console.log(\`Document \${payload.document_id} is now \${payload.status}\`);

    if (payload.status === "ready") {
      await notifyDocumentReady(payload.document_id);
    }
  })
  .event(connection_sync_finished, async (payload) => {
    console.log(\`Sync \${payload.sync_id} completed\`);
  })
  .onError((error, context) => {
    console.error(\`Error in \${context.eventType}\`, error);
  });

http("webhookHandler", toGCPFunction(webhook));`,
  },
};

const sdkFeatures = [
  {
    icon: Shield,
    title: "Signature Verification",
    description:
      "Automatic HMAC verification for all providers. Timing-safe comparison prevents attacks.",
    color: "var(--nb-coral)",
  },
  {
    icon: Sparkles,
    title: "Type-Safe Handlers",
    description:
      "Full TypeScript support with Zod schemas. Autocomplete for every payload property.",
    color: "var(--nb-yellow)",
  },
  {
    icon: Layers,
    title: "Framework Adapters",
    description:
      "First-class support for Next.js, Hono, Express, NestJS, and GCP Functions.",
    color: "var(--nb-blue)",
  },
];

const frameworkLabels: Record<Framework, string> = {
  nextjs: "Next.js",
  hono: "Hono",
  express: "Express",
  nestjs: "NestJS",
  "gcp-functions": "GCP",
};

const providerInfo = [
  {
    key: "github",
    name: "GitHub",
    events: [
      "push",
      "pull_request",
      "issues",
      "installation",
      "installation_repositories",
    ],
    package: "@better-webhook/github",
    color: "var(--nb-coral)",
  },
  {
    key: "ragie",
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
    color: "var(--nb-green)",
  },
  {
    key: "recall",
    name: "Recall.ai",
    events: [
      "participant_events.join",
      "participant_events.leave",
      "participant_events.chat_message",
      "transcript.data",
      "transcript.partial_data",
      "bot.joining_call",
      "bot.done",
      "bot.fatal",
    ],
    package: "@better-webhook/recall",
    color: "var(--nb-blue)",
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
    <section className="nb-section bg-[var(--nb-cream)]">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="nb-sticker nb-sticker-blue mb-6 inline-flex">
            <span>SDK Packages</span>
          </div>
          <h2 className="font-bold text-3xl sm:text-4xl tracking-tight mb-3 uppercase">
            Type-safe. Verified. <span className="nb-highlight">Simple</span>.
          </h2>
          <p className="text-base text-[var(--nb-text-muted)] max-w-2xl mx-auto">
            Build webhook handlers with full TypeScript support, automatic
            signature verification, and Zod schema validation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {sdkFeatures.map((feature) => (
            <div key={feature.title} className="nb-card p-5 text-center">
              <div
                className="w-11 h-11 flex items-center justify-center border-2 border-[var(--nb-border-color)] mx-auto mb-3"
                style={{ color: feature.color }}
              >
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base mb-1.5">{feature.title}</h3>
              <p className="text-sm text-[var(--nb-text-muted)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-center mb-6 overflow-x-auto">
          <div className="nb-tabs">
            {(
              [
                "nextjs",
                "hono",
                "express",
                "nestjs",
                "gcp-functions",
              ] as Framework[]
            ).map((fw) => (
              <button
                key={fw}
                onClick={() => setActiveFramework(fw)}
                className={`nb-tab ${activeFramework === fw ? "active" : ""}`}
              >
                {frameworkLabels[fw]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 max-w-4xl mx-auto">
          <div className="nb-install">
            <div className="nb-install-text">
              <span className="text-[var(--nb-green)]">$</span>{" "}
              <span>{current.install}</span>
            </div>
            <button
              onClick={() => copyToClipboard(current.install, "install")}
              className="nb-install-btn"
              title="Copy"
            >
              {copiedInstall ? (
                <Check className="w-4 h-4 text-[var(--nb-green)]" />
              ) : (
                <Copy className="w-4 h-4 text-[var(--nb-text-muted)]" />
              )}
            </button>
          </div>

          <div className="nb-code-block">
            <div className="nb-code-header">
              <div className="nb-terminal-dot nb-terminal-dot-red" />
              <div className="nb-terminal-dot nb-terminal-dot-yellow" />
              <div className="nb-terminal-dot nb-terminal-dot-green" />
              <span className="ml-3 text-xs text-[#666] font-mono">
                {current.filename}
              </span>
              <button
                onClick={() => copyToClipboard(current.code, "code")}
                className="ml-auto p-1.5 hover:bg-[#333] transition-colors"
                title="Copy code"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-[var(--nb-green)]" />
                ) : (
                  <Copy className="w-4 h-4 text-[#666]" />
                )}
              </button>
            </div>
            <div className="nb-code-body overflow-x-auto max-h-[400px] sm:max-h-[500px]">
              <pre className="font-mono text-xs sm:text-sm leading-relaxed">
                <code
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(current.code),
                  }}
                />
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h3 className="text-center font-bold text-sm uppercase tracking-widest text-[var(--nb-text-muted)] mb-6">
            Available Providers
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {providerInfo.map((provider) => (
              <div key={provider.key} className="nb-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center border-2 border-[var(--nb-border-color)] font-bold text-lg"
                    style={{ color: provider.color }}
                  >
                    {provider.name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{provider.name}</h4>
                    <code className="text-xs text-[var(--nb-text-muted)] font-mono">
                      {provider.package}
                    </code>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {provider.events.slice(0, 4).map((event) => (
                    <span
                      key={event}
                      className="text-[10px] font-mono px-2 py-0.5 bg-[var(--nb-cream)] border border-[var(--nb-border-color)] text-[var(--nb-text-muted)]"
                    >
                      {event}
                    </span>
                  ))}
                  {provider.events.length > 4 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 text-[var(--nb-text-muted)]">
                      +{provider.events.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/docs/sdk" className="nb-btn nb-btn-primary inline-flex">
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

  const tokens: { placeholder: string; html: string }[] = [];
  let tokenIndex = 0;

  result = result.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, (match) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`;
    tokens.push({
      placeholder,
      html: `<span style="color:var(--nb-yellow)">${match}</span>`,
    });
    return placeholder;
  });

  result = result.replace(/(\/\/.*$)/gm, (match) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`;
    tokens.push({
      placeholder,
      html: `<span style="color:#555">${match}</span>`,
    });
    return placeholder;
  });

  result = result.replace(
    /\b(import|from|const|async|await|if|export|return|new)\b/g,
    (match) => {
      const placeholder = `__TOKEN_${tokenIndex++}__`;
      tokens.push({
        placeholder,
        html: `<span style="color:var(--nb-coral)">${match}</span>`,
      });
      return placeholder;
    },
  );

  result = result.replace(/(@[\w-]+\/[\w.-]+)/g, (match) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`;
    tokens.push({
      placeholder,
      html: `<span style="color:var(--nb-lavender)">${match}</span>`,
    });
    return placeholder;
  });

  tokens.forEach(({ placeholder, html }) => {
    result = result.replace(placeholder, html);
  });

  return result;
}
