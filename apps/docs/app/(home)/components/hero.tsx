"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Github, Terminal, Code2, Copy, Check } from "lucide-react";

const codeBlock = `import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event(push, async (payload) => {
    // Fully typed payload
    console.log(payload.repository.name);
    console.log(payload.commits.length);
  })
  .event(pull_request, async (payload) => {
    if (payload.action === "opened") {
      await notifyTeam(payload.pull_request);
    }
  });

export const POST = toNextJS(webhook);`;

export function Hero() {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(true);
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  const copyCommand = async () => {
    await navigator.clipboard.writeText(
      "brew install --cask endalk200/tap/better-webhook",
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden lyra-grid-bg">
      {/* Gradient orbs */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-[var(--lyra-primary)] opacity-5 blur-[100px]" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[var(--lyra-accent)] opacity-5 blur-[100px]" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Text Content */}
          <div
            className={`space-y-8 ${isVisible ? "lyra-animate-slide-up" : "opacity-0"}`}
          >
            {/* Badge */}
            <div className="lyra-badge lyra-badge-primary">
              <Terminal className="w-3.5 h-3.5" />
              <span>Local Webhook Capture + Type-Safe SDK</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-mono">
              <span className="block text-[var(--lyra-text)]">Webhooks.</span>
              <span className="gradient-text">Type-safe. Local-first.</span>
            </h1>

            {/* Description */}
            <p className="text-lg text-[var(--lyra-text-secondary)] max-w-xl leading-relaxed">
              Two tools, one workflow: capture real webhook traffic locally,
              then ship verified handlers with type-safe SDK adapters. Use the{" "}
              <span className="text-[var(--lyra-primary)]">CLI</span> for
              capture/replay and the{" "}
              <span className="text-[var(--lyra-accent)]">SDK</span> for
              production webhook endpoints.
            </p>

            {/* CTA stack */}
            <div className="space-y-3">
              <Link
                href="#quick-start"
                className="lyra-btn lyra-btn-primary inline-flex items-center justify-center gap-2"
              >
                <Terminal className="w-4 h-4" />
                Get started in 60 seconds
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/docs/cli"
                  className="lyra-btn lyra-btn-secondary inline-flex items-center justify-center gap-2"
                >
                  <Terminal className="w-4 h-4" />
                  CLI Docs
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/docs/sdk"
                  className="lyra-btn lyra-btn-secondary inline-flex items-center justify-center gap-2"
                >
                  <Code2 className="w-4 h-4" />
                  SDK Docs
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Install command */}
            <div className="space-y-3 pt-4">
              <p className="text-xs text-[var(--lyra-text-muted)] font-mono uppercase tracking-wider">
                Quick Install
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 bg-[var(--lyra-surface)] border border-[var(--lyra-border)] font-mono text-sm">
                  <span className="text-[var(--lyra-accent)]">$</span>{" "}
                  <span className="text-[var(--lyra-text)]">
                    brew install --cask endalk200/tap/better-webhook
                  </span>
                </code>
                <button
                  onClick={copyCommand}
                  className="p-3 border border-[var(--lyra-border)] bg-[var(--lyra-surface)] hover:border-[var(--lyra-primary)] transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-[var(--lyra-accent)]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[var(--lyra-text-muted)]" />
                  )}
                </button>
              </div>
            </div>

            {/* GitHub link */}
            <div className="pt-2">
              <a
                href="https://github.com/endalk200/better-webhook"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--lyra-text-muted)] hover:text-[var(--lyra-primary)] transition-colors font-mono"
              >
                <Github className="w-4 h-4" />
                View on GitHub
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Right - Code Block */}
          <div
            className={`${isVisible ? "lyra-animate-slide-up lyra-delay-200" : "opacity-0"}`}
          >
            <div className="lyra-code-block shadow-2xl">
              {/* Header */}
              <div className="lyra-code-header">
                <div className="lyra-code-dot lyra-code-dot-red" />
                <div className="lyra-code-dot lyra-code-dot-yellow" />
                <div className="lyra-code-dot lyra-code-dot-green" />
                <span className="ml-3 text-xs text-[var(--lyra-text-muted)] font-mono uppercase tracking-wider">
                  app/api/webhooks/github/route.ts
                </span>
              </div>

              {/* Code */}
              <div className="lyra-code-body overflow-x-auto">
                <pre className="font-mono text-sm leading-relaxed">
                  <code>
                    <CodeHighlight code={codeBlock} />
                  </code>
                </pre>
              </div>
            </div>

            {/* Stats below code */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center p-4 border border-[var(--lyra-border)] bg-[var(--lyra-surface)]">
                <div className="text-2xl font-bold font-mono text-[var(--lyra-primary)]">
                  3
                </div>
                <div className="text-xs text-[var(--lyra-text-muted)] font-mono uppercase tracking-wider">
                  Providers
                </div>
              </div>
              <div className="text-center p-4 border border-[var(--lyra-border)] bg-[var(--lyra-surface)]">
                <div className="text-2xl font-bold font-mono text-[var(--lyra-accent)]">
                  5
                </div>
                <div className="text-xs text-[var(--lyra-text-muted)] font-mono uppercase tracking-wider">
                  Adapters
                </div>
              </div>
              <div className="text-center p-4 border border-[var(--lyra-border)] bg-[var(--lyra-surface)]">
                <div className="text-2xl font-bold font-mono text-[var(--lyra-warning)]">
                  100%
                </div>
                <div className="text-xs text-[var(--lyra-text-muted)] font-mono uppercase tracking-wider">
                  Type-safe
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CodeHighlight({ code }: { code: string }) {
  const lines = code.split("\n");

  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className="table-row">
          <span className="table-cell pr-4 text-[var(--lyra-text-muted)] select-none text-right w-8 opacity-50">
            {i + 1}
          </span>
          <span className="table-cell">
            <LineHighlight line={line} />
          </span>
        </div>
      ))}
    </>
  );
}

function LineHighlight({ line }: { line: string }) {
  // Handle comments
  if (line.trim().startsWith("//")) {
    return <span className="text-[var(--lyra-text-muted)]">{line}</span>;
  }

  // Tokenize and highlight
  let result: React.ReactNode[] = [];
  let key = 0;

  // Highlight strings first
  const stringRegex = /"[^"]*"|'[^']*'|`[^`]*`/g;
  let lastIndex = 0;
  let match;

  while ((match = stringRegex.exec(line)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      result.push(
        <span key={key++}>
          {highlightKeywords(line.slice(lastIndex, match.index))}
        </span>,
      );
    }
    // Add the string
    result.push(
      <span key={key++} className="text-[var(--lyra-warning)]">
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < line.length) {
    result.push(
      <span key={key++}>{highlightKeywords(line.slice(lastIndex))}</span>,
    );
  }

  return result.length > 0 ? <>{result}</> : <span>{line}</span>;
}

function highlightKeywords(text: string): React.ReactNode {
  const keywords = [
    "import",
    "from",
    "const",
    "async",
    "await",
    "if",
    "export",
  ];
  const parts: React.ReactNode[] = [];
  const regex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={key++} className="text-[var(--lyra-primary)]">
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}
