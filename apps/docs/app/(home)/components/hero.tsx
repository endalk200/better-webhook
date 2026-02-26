"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Github, Terminal, Code2, Copy, Check } from "lucide-react";

const codeBlock = `import { github } from "@better-webhook/github";
import { push, pull_request } from "@better-webhook/github/events";
import { toNextJS } from "@better-webhook/nextjs";

const webhook = github()
  .event(push, async (payload) => {
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
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handle = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  const copyCommand = async () => {
    await navigator.clipboard.writeText(
      "brew install --cask endalk200/tap/better-webhook",
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative flex flex-1 items-center overflow-hidden nb-dots-hero bg-[var(--nb-cream)] py-16 lg:py-24">
      <div className="relative z-10 container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left — Text */}
          <div
            className={`space-y-6 ${visible ? "nb-animate-fade-up" : "opacity-0"}`}
          >
            <div className="nb-sticker nb-sticker-yellow">
              <Terminal className="w-3.5 h-3.5" />
              <span>Local-first Webhook Toolkit</span>
            </div>

            <h1 className="font-bold text-3xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.1] uppercase">
              <span className="block">Stop fighting</span>
              <span className="block">
                <span className="nb-highlight">webhooks</span>.
              </span>
            </h1>

            <p className="text-lg text-[var(--nb-text-muted)] max-w-lg leading-relaxed">
              The local-first toolkit for capturing, replaying, and shipping
              type-safe webhook handlers in TypeScript.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="#quick-start" className="nb-btn nb-btn-primary">
                <Terminal className="w-4 h-4" />
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/docs" className="nb-btn nb-btn-secondary">
                <Code2 className="w-4 h-4" />
                Read the Docs
              </Link>
            </div>

            <div className="space-y-2 pt-2">
              <p className="font-bold text-xs uppercase tracking-widest text-[var(--nb-text-muted)]">
                Quick Install
              </p>
              <div className="nb-install max-w-lg">
                <div className="nb-install-text">
                  <span className="text-[var(--nb-green)]">$</span>{" "}
                  <span>brew install --cask endalk200/tap/better-webhook</span>
                </div>
                <button
                  onClick={copyCommand}
                  className="nb-install-btn"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-[var(--nb-green)]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[var(--nb-text-muted)]" />
                  )}
                </button>
              </div>
            </div>

            <a
              href="https://github.com/endalk200/better-webhook"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-bold text-sm text-[var(--nb-text-muted)] hover:text-[var(--nb-coral)] transition-colors"
            >
              <Github className="w-4 h-4" />
              View on GitHub
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          {/* Right — Code Block */}
          <div
            className={`hidden sm:block ${visible ? "nb-animate-fade-up nb-delay-200" : "opacity-0"}`}
          >
            <div className="nb-code-block">
              <div className="nb-code-header">
                <div className="nb-terminal-dot nb-terminal-dot-red" />
                <div className="nb-terminal-dot nb-terminal-dot-yellow" />
                <div className="nb-terminal-dot nb-terminal-dot-green" />
                <span className="ml-3 text-xs text-[#666] font-mono uppercase tracking-wider">
                  app/api/webhooks/github/route.ts
                </span>
              </div>
              <div className="nb-code-body overflow-x-auto">
                <pre className="font-mono text-xs sm:text-sm leading-relaxed">
                  <code>
                    <CodeHighlight code={codeBlock} />
                  </code>
                </pre>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { value: "3", label: "Providers", color: "var(--nb-coral)" },
                { value: "5", label: "Adapters", color: "var(--nb-blue)" },
                {
                  value: "100%",
                  label: "Type-safe",
                  color: "var(--nb-green)",
                },
              ].map((stat) => (
                <div key={stat.label} className="nb-card-flat text-center p-3">
                  <div
                    className="text-xl font-bold"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--nb-text-muted)] mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile-only stats */}
          <div
            className={`sm:hidden grid grid-cols-3 gap-2 ${visible ? "nb-animate-fade-up nb-delay-200" : "opacity-0"}`}
          >
            {[
              { value: "3", label: "Providers", color: "var(--nb-coral)" },
              { value: "5", label: "Adapters", color: "var(--nb-blue)" },
              {
                value: "100%",
                label: "Type-safe",
                color: "var(--nb-green)",
              },
            ].map((stat) => (
              <div key={stat.label} className="nb-card-flat text-center p-2.5">
                <div
                  className="text-lg font-bold"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--nb-text-muted)] mt-0.5">
                  {stat.label}
                </div>
              </div>
            ))}
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
          <span className="table-cell pr-4 text-[#555] select-none text-right w-8 opacity-50">
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
  if (line.trim().startsWith("//")) {
    return <span className="text-[#555]">{line}</span>;
  }

  const result: React.ReactNode[] = [];
  let key = 0;

  const stringRegex = /"[^"]*"|'[^']*'|`[^`]*`/g;
  let lastIndex = 0;
  let match;

  while ((match = stringRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      result.push(
        <span key={key++}>
          {highlightKeywords(line.slice(lastIndex, match.index))}
        </span>,
      );
    }
    result.push(
      <span key={key++} className="text-[var(--nb-yellow)]">
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

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
      <span key={key++} className="text-[var(--nb-coral)]">
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
