"use client";

import { useState } from "react";
import { Copy, Check, ArrowRight, Terminal, Code2 } from "lucide-react";
import Link from "next/link";

type Tab = "cli" | "sdk";
type Framework = "nextjs" | "hono" | "express" | "nestjs" | "gcp-functions";

const cliSteps = [
  {
    step: 1,
    title: "Install the CLI",
    command: "brew install --cask endalk200/tap/better-webhook",
    isCommand: true,
  },
  {
    step: 2,
    title: "Start capture server",
    command: "better-webhook capture --port 3001",
    note: "Stores incoming webhooks locally under ~/.better-webhook/captures",
    isCommand: true,
  },
  {
    step: 3,
    title: "Point webhooks to capture server",
    command: "http://localhost:3001/webhooks/your-provider",
    note: "Use this URL in your webhook provider settings (e.g., GitHub webhook URL)",
    isCommand: false,
  },
  {
    step: 4,
    title: "Replay captured webhooks",
    command:
      "better-webhook captures replay <capture-id> http://localhost:3000/api/webhooks/github",
    note: "Replay to your local development server",
    isCommand: true,
  },
];

const sdkCode: Record<
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
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      console.log(\`New PR: \${payload.pull_request.title}\`);
    }
  });

export const POST = toNextJS(webhook);`,
  },
  express: {
    install: "npm install @better-webhook/github @better-webhook/express",
    filename: "src/webhooks.ts",
    code: `import express from "express";
import { github } from "@better-webhook/github";
import { push } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github()
  .event(push, async (payload) => {
    console.log(\`Push to \${payload.repository.name}\`);
  });

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook)
);`,
  },
  hono: {
    install: "npm install @better-webhook/github @better-webhook/hono",
    filename: "src/webhooks.ts",
    code: `import { Hono } from "hono";
import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toHono } from "@better-webhook/hono";

const app = new Hono();

const webhook = github()
  .event(push, async (payload) => {
    console.log(\`Push to \${payload.repository.name}\`);
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      console.log(\`New PR: \${payload.pull_request.title}\`);
    }
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
import { push } from "@better-webhook/github/events";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github()
    .event(push, async (payload) => {
      console.log(\`Push to \${payload.repository.name}\`);
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
import { document_status_updated } from "@better-webhook/ragie/events";
import { toGCPFunction } from "@better-webhook/gcp-functions";

const webhook = ragie()
  .event(document_status_updated, async (payload) => {
    console.log(\`Document \${payload.document_id} status: \${payload.status}\`);
  });

http("webhookHandler", toGCPFunction(webhook));`,
  },
};

const frameworks: { id: Framework; name: string }[] = [
  { id: "nextjs", name: "Next.js" },
  { id: "hono", name: "Hono" },
  { id: "express", name: "Express" },
  { id: "nestjs", name: "NestJS" },
  { id: "gcp-functions", name: "GCP" },
];

export function QuickStart() {
  const [activeTab, setActiveTab] = useState<Tab>("cli");
  const [activeFramework, setActiveFramework] = useState<Framework>("nextjs");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const current = sdkCode[activeFramework];
  const secretEnvVar =
    activeFramework === "gcp-functions"
      ? "RAGIE_WEBHOOK_SECRET"
      : "GITHUB_WEBHOOK_SECRET";

  return (
    <section id="quick-start" className="nb-section nb-section-dark">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-10">
          <div className="nb-sticker nb-sticker-coral mb-6 inline-flex">
            <span>Quick Start</span>
          </div>
          <h2 className="font-bold text-3xl sm:text-4xl tracking-tight mb-3 uppercase">
            Get started in <span className="text-[var(--nb-yellow)]">60s</span>
          </h2>
          <p className="text-base text-[var(--nb-text-muted)] max-w-2xl mx-auto">
            Choose how you want to work with webhooks — capture and replay with
            the CLI, or build type-safe handlers with the SDK.
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <div
            className="nb-tabs"
            role="tablist"
            aria-label="Quick start method"
          >
            <button
              onClick={() => setActiveTab("cli")}
              className={`nb-tab ${activeTab === "cli" ? "active" : ""}`}
              role="tab"
              aria-selected={activeTab === "cli"}
            >
              <Terminal
                className="w-3.5 h-3.5 inline-block mr-2"
                aria-hidden="true"
              />
              CLI
            </button>
            <button
              onClick={() => setActiveTab("sdk")}
              className={`nb-tab ${activeTab === "sdk" ? "active" : ""}`}
              role="tab"
              aria-selected={activeTab === "sdk"}
            >
              <Code2
                className="w-3.5 h-3.5 inline-block mr-2"
                aria-hidden="true"
              />
              SDK
            </button>
          </div>
        </div>

        {activeTab === "cli" ? (
          <div className="space-y-5">
            {cliSteps.map((item, index) => (
              <div key={item.step} className="flex gap-4">
                <div
                  className="nb-step-number"
                  style={{
                    background: "var(--nb-coral)",
                    color: "#fff",
                  }}
                >
                  {item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base mb-2">{item.title}</h3>
                  <div className="flex items-center gap-0">
                    <code className="flex-1 px-3 sm:px-4 py-2.5 bg-[#0a0a0a] border-2 border-[var(--nb-border-color)] font-mono text-xs sm:text-sm overflow-x-auto text-[#e0e0e0] min-w-0">
                      {item.isCommand ? (
                        <>
                          <span className="text-[var(--nb-green)]">$</span>{" "}
                          <span className="text-white">{item.command}</span>
                        </>
                      ) : (
                        <span className="text-white">{item.command}</span>
                      )}
                    </code>
                    <button
                      onClick={() => copyToClipboard(item.command, index)}
                      className="p-2.5 border-2 border-[var(--nb-border-color)] border-l-0 bg-[var(--nb-cream)] hover:bg-[var(--nb-yellow)] transition-colors flex-shrink-0"
                      title="Copy"
                      aria-label={`Copy ${item.title}`}
                    >
                      {copiedIndex === index ? (
                        <Check
                          className="w-4 h-4 text-[var(--nb-green)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy
                          className="w-4 h-4 text-[var(--nb-text-muted)]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>
                  {item.note && (
                    <p className="mt-1.5 text-sm text-[var(--nb-text-muted)]">
                      {item.note}
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div className="pt-6 text-center">
              <Link
                href="/docs/cli"
                className="nb-btn nb-btn-secondary inline-flex"
              >
                Full CLI Documentation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center overflow-x-auto">
              <div className="nb-tabs" role="tablist" aria-label="Framework">
                {frameworks.map((fw) => (
                  <button
                    key={fw.id}
                    onClick={() => setActiveFramework(fw.id)}
                    className={`nb-tab ${activeFramework === fw.id ? "active" : ""}`}
                    role="tab"
                    aria-selected={activeFramework === fw.id}
                  >
                    {fw.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div
                className="nb-step-number"
                style={{ background: "var(--nb-blue)", color: "#fff" }}
              >
                1
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base mb-2">Install packages</h3>
                <div className="flex items-center gap-0">
                  <code className="flex-1 px-3 sm:px-4 py-2.5 bg-[#0a0a0a] border-2 border-[var(--nb-border-color)] font-mono text-xs sm:text-sm overflow-x-auto text-[#e0e0e0] min-w-0">
                    <span className="text-[var(--nb-green)]">$</span>{" "}
                    <span className="text-white">{current.install}</span>
                  </code>
                  <button
                    onClick={() => copyToClipboard(current.install, 100)}
                    className="p-2.5 border-2 border-[var(--nb-border-color)] border-l-0 bg-[var(--nb-cream)] hover:bg-[var(--nb-yellow)] transition-colors flex-shrink-0"
                    title="Copy"
                    aria-label="Copy install command"
                  >
                    {copiedIndex === 100 ? (
                      <Check
                        className="w-4 h-4 text-[var(--nb-green)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <Copy
                        className="w-4 h-4 text-[var(--nb-text-muted)]"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div
                className="nb-step-number"
                style={{ background: "var(--nb-blue)", color: "#fff" }}
              >
                2
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base mb-2">
                  Create webhook handler
                </h3>
                <div className="nb-code-block">
                  <div className="nb-code-header">
                    <div className="nb-terminal-dot nb-terminal-dot-red" />
                    <div className="nb-terminal-dot nb-terminal-dot-yellow" />
                    <div className="nb-terminal-dot nb-terminal-dot-green" />
                    <span className="ml-3 text-xs text-[#666] font-mono">
                      {current.filename}
                    </span>
                    <button
                      onClick={() => copyToClipboard(current.code, 101)}
                      className="ml-auto p-1.5 hover:bg-[#333] transition-colors"
                      title="Copy code"
                      aria-label="Copy code"
                    >
                      {copiedIndex === 101 ? (
                        <Check
                          className="w-4 h-4 text-[var(--nb-green)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy
                          className="w-4 h-4 text-[#666]"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>
                  <div className="nb-code-body overflow-x-auto max-h-[350px] sm:max-h-[400px]">
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
            </div>

            <div className="flex gap-4">
              <div
                className="nb-step-number"
                style={{ background: "var(--nb-blue)", color: "#fff" }}
              >
                3
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base mb-2">Set webhook secret</h3>
                <code className="block px-3 sm:px-4 py-2.5 bg-[#0a0a0a] border-2 border-[var(--nb-border-color)] font-mono text-xs sm:text-sm text-[#e0e0e0] overflow-x-auto">
                  <span className="text-[#555]"># .env</span>
                  <br />
                  <span className="text-white">
                    {secretEnvVar}=your_webhook_secret
                  </span>
                </code>
                <p className="mt-2 text-sm text-[var(--nb-text-muted)]">
                  Done! Your webhook endpoint has automatic signature
                  verification and full TypeScript support.
                </p>
              </div>
            </div>

            <div className="pt-6 text-center">
              <Link
                href="/docs/sdk"
                className="nb-btn nb-btn-primary inline-flex"
              >
                Full SDK Documentation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
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
    /\b(import|from|const|async|await|if|export|return)\b/g,
    (match) => {
      const placeholder = `__TOKEN_${tokenIndex++}__`;
      tokens.push({
        placeholder,
        html: `<span style="color:var(--nb-coral)">${match}</span>`,
      });
      return placeholder;
    },
  );

  result = result.replace(/(@\w+)/g, (match) => {
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
