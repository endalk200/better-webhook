"use client";

import { useState } from "react";
import { Copy, Check, ArrowRight, Terminal, Code2 } from "lucide-react";
import Link from "next/link";

type Tab = "cli" | "sdk";
type Framework = "nextjs" | "express" | "nestjs";

const cliSteps = [
  {
    step: 1,
    title: "Install the CLI",
    command: "npm install -g @better-webhook/cli",
  },
  {
    step: 2,
    title: "Start the dashboard",
    command: "better-webhook dashboard",
    note: "Opens a local UI at http://localhost:4000 with capture server at port 3001",
  },
  {
    step: 3,
    title: "Point webhooks to capture server",
    command: "http://localhost:3001/webhooks/github",
    note: "Use this URL in your webhook provider settings (e.g., GitHub webhook URL)",
  },
  {
    step: 4,
    title: "Replay captured webhooks",
    command:
      "better-webhook replay <capture-id> http://localhost:3000/api/webhooks/github",
    note: "Replay to your local development server",
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
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event("push", async (payload) => {
    console.log(\`Push to \${payload.repository.name}\`);
  })
  .event("pull_request", async (payload) => {
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
import { toExpress } from "@better-webhook/express";

const app = express();

const webhook = github()
  .event("push", async (payload) => {
    console.log(\`Push to \${payload.repository.name}\`);
  });

app.post(
  "/webhooks/github",
  express.raw({ type: "application/json" }),
  toExpress(webhook)
);`,
  },
  nestjs: {
    install: "npm install @better-webhook/github @better-webhook/nestjs",
    filename: "src/webhooks.controller.ts",
    code: `import { Controller, Post, Req, Res } from "@nestjs/common";
import { github } from "@better-webhook/github";
import { toNestJS } from "@better-webhook/nestjs";

@Controller("webhooks")
export class WebhooksController {
  private webhook = github()
    .event("push", async (payload) => {
      console.log(\`Push to \${payload.repository.name}\`);
    });

  @Post("github")
  async handleGitHub(@Req() req: any, @Res() res: any) {
    const result = await toNestJS(this.webhook)(req);
    return res.status(result.statusCode).json(result.body);
  }
}`,
  },
};

const frameworks: { id: Framework; name: string }[] = [
  { id: "nextjs", name: "Next.js" },
  { id: "express", name: "Express" },
  { id: "nestjs", name: "NestJS" },
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

  return (
    <section className="lyra-section lyra-section-dark">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold font-mono mb-4">
            Get started in <span className="gradient-text">minutes</span>
          </h2>
          <p className="text-lg text-[var(--lyra-text-secondary)] max-w-2xl mx-auto">
            Choose how you want to work with webhooks - capture and replay with
            the CLI, or build type-safe handlers with the SDK.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-12">
          <div className="lyra-tabs">
            <button
              onClick={() => setActiveTab("cli")}
              className={`lyra-tab ${activeTab === "cli" ? "active" : ""}`}
            >
              <Terminal className="w-3.5 h-3.5 inline-block mr-2" />
              CLI
            </button>
            <button
              onClick={() => setActiveTab("sdk")}
              className={`lyra-tab ${activeTab === "sdk" ? "active" : ""}`}
            >
              <Code2 className="w-3.5 h-3.5 inline-block mr-2" />
              SDK
            </button>
          </div>
        </div>

        {activeTab === "cli" ? (
          /* CLI Steps */
          <div className="space-y-6">
            {cliSteps.map((item, index) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[var(--lyra-primary)] text-[#0a0a0a] flex items-center justify-center font-mono font-bold text-sm">
                  {item.step}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold font-mono mb-2 text-white">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-3 bg-[#0a0a0a] border border-[var(--lyra-border)] font-mono text-sm overflow-x-auto">
                      <span className="text-[var(--lyra-accent)]">$</span>{" "}
                      <span className="text-white">{item.command}</span>
                    </code>
                    <button
                      onClick={() => copyToClipboard(item.command, index)}
                      className="p-3 border border-[var(--lyra-border)] bg-[#0a0a0a] hover:border-[var(--lyra-primary)] transition-colors flex-shrink-0"
                      title="Copy to clipboard"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-4 h-4 text-[var(--lyra-accent)]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--lyra-text-muted)]" />
                      )}
                    </button>
                  </div>
                  {item.note && (
                    <p className="mt-2 text-sm text-[var(--lyra-text-muted)]">
                      {item.note}
                    </p>
                  )}
                </div>
              </div>
            ))}

            <div className="pt-6 text-center">
              <Link
                href="/docs/cli"
                className="lyra-btn lyra-btn-secondary inline-flex items-center gap-2"
              >
                Full CLI Documentation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* SDK Steps */
          <div className="space-y-8">
            {/* Framework Tabs */}
            <div className="flex justify-center">
              <div className="lyra-tabs">
                {frameworks.map((framework) => (
                  <button
                    key={framework.id}
                    onClick={() => setActiveFramework(framework.id)}
                    className={`lyra-tab ${activeFramework === framework.id ? "active" : ""}`}
                  >
                    {framework.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 1: Install */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--lyra-accent)] text-[#0a0a0a] flex items-center justify-center font-mono font-bold text-sm">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold font-mono mb-2 text-white">
                  Install packages
                </h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-[#0a0a0a] border border-[var(--lyra-border)] font-mono text-sm overflow-x-auto">
                    <span className="text-[var(--lyra-accent)]">$</span>{" "}
                    <span className="text-white">{current.install}</span>
                  </code>
                  <button
                    onClick={() => copyToClipboard(current.install, 100)}
                    className="p-3 border border-[var(--lyra-border)] bg-[#0a0a0a] hover:border-[var(--lyra-primary)] transition-colors flex-shrink-0"
                    title="Copy to clipboard"
                  >
                    {copiedIndex === 100 ? (
                      <Check className="w-4 h-4 text-[var(--lyra-accent)]" />
                    ) : (
                      <Copy className="w-4 h-4 text-[var(--lyra-text-muted)]" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Code */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--lyra-accent)] text-[#0a0a0a] flex items-center justify-center font-mono font-bold text-sm">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold font-mono mb-2 text-white">
                  Create webhook handler
                </h3>
                <div className="lyra-code-block">
                  <div className="lyra-code-header">
                    <div className="lyra-code-dot lyra-code-dot-red" />
                    <div className="lyra-code-dot lyra-code-dot-yellow" />
                    <div className="lyra-code-dot lyra-code-dot-green" />
                    <span className="ml-3 text-xs text-[var(--lyra-text-muted)] font-mono">
                      {current.filename}
                    </span>
                    <button
                      onClick={() => copyToClipboard(current.code, 101)}
                      className="ml-auto p-1.5 hover:bg-[var(--lyra-border)] transition-colors"
                      title="Copy code"
                    >
                      {copiedIndex === 101 ? (
                        <Check className="w-4 h-4 text-[var(--lyra-accent)]" />
                      ) : (
                        <Copy className="w-4 h-4 text-[var(--lyra-text-muted)]" />
                      )}
                    </button>
                  </div>
                  <div className="lyra-code-body overflow-x-auto max-h-[400px]">
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
            </div>

            {/* Step 3: Environment */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--lyra-accent)] text-[#0a0a0a] flex items-center justify-center font-mono font-bold text-sm">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold font-mono mb-2 text-white">
                  Set webhook secret
                </h3>
                <code className="block px-4 py-3 bg-[#0a0a0a] border border-[var(--lyra-border)] font-mono text-sm">
                  <span className="text-[var(--lyra-text-muted)]"># .env</span>
                  <br />
                  <span className="text-white">
                    GITHUB_WEBHOOK_SECRET=your_webhook_secret
                  </span>
                </code>
                <p className="mt-3 text-sm text-[var(--lyra-text-secondary)]">
                  Done! Your webhook endpoint has automatic signature
                  verification and full TypeScript support.
                </p>
              </div>
            </div>

            <div className="pt-6 text-center">
              <Link
                href="/docs/sdk"
                className="lyra-btn lyra-btn-primary inline-flex items-center gap-2"
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
