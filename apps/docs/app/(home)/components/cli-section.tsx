"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Radio, RotateCcw, FileCode } from "lucide-react";

const commands = [
  {
    prompt: "$ ",
    command: "better-webhook captures list",
    output: [
      "",
      "\u{1F4DA} Captured webhooks:",
      "",
      "   - abc12345 [github] POST /webhooks/github (2456 bytes)",
      "   - def67890 [ragie] POST /webhooks/ragie (1821 bytes)",
      "",
    ],
    delay: 1200,
  },
  {
    prompt: "$ ",
    command: "better-webhook capture --port 3001",
    output: [
      "",
      "\u{1F3A3} Webhook Capture Server",
      "   Listening on http://localhost:3001",
      "   Captures saved to: ~/.better-webhook/captures",
      "",
      "\u{1F4E5} Captured webhook from github",
      "   ID: abc12345",
      "   Event: push",
      "   Size: 2.4 KB",
    ],
    delay: 1500,
  },
  {
    prompt: "$ ",
    command:
      "better-webhook captures replay abc12345 http://localhost:3000/api/webhooks/github",
    output: [
      "",
      "\u{1F504} Replaying Webhook",
      "",
      "   Capture ID: abc12345",
      "   Target: http://localhost:3000/api/webhooks/github",
      "",
      "\u{1F4E5} Response",
      "",
      "   Status: 200 OK",
      "   Duration: 45ms",
      "",
      "\u2713 Replay completed successfully",
    ],
    delay: 1200,
  },
];

const cliFeatures = [
  {
    icon: Radio,
    title: "Capture",
    description:
      "Start a local server to intercept and store incoming webhooks",
    command: "better-webhook capture",
    color: "var(--nb-coral)",
  },
  {
    icon: RotateCcw,
    title: "Replay",
    description: "Re-send captured webhooks to any endpoint with full headers",
    command: "better-webhook captures replay <id> <url>",
    color: "var(--nb-blue)",
  },
  {
    icon: FileCode,
    title: "Templates",
    description:
      "Download and run curated templates for GitHub, Ragie, and Recall.ai",
    command: "better-webhook templates list",
    color: "var(--nb-yellow)",
  },
];

export function CLISection() {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let lineIndex = 0;
    let commandIndex = 0;

    const typeNextLine = () => {
      if (commandIndex >= commands.length) {
        timeout = setTimeout(() => {
          setVisibleLines([]);
          commandIndex = 0;
          lineIndex = 0;
          typeNextLine();
        }, 4000);
        return;
      }

      const cmd = commands[commandIndex];

      if (lineIndex === 0) {
        setVisibleLines((prev) => [...prev, cmd.prompt + cmd.command]);
        lineIndex++;
        timeout = setTimeout(typeNextLine, cmd.delay);
      } else if (lineIndex <= cmd.output.length) {
        setVisibleLines((prev) => [...prev, cmd.output[lineIndex - 1]]);
        lineIndex++;
        timeout = setTimeout(typeNextLine, 60);
      } else {
        commandIndex++;
        lineIndex = 0;
        timeout = setTimeout(typeNextLine, 1500);
      }
    };

    typeNextLine();
    return () => clearTimeout(timeout);
  }, []);

  return (
    <section className="nb-section nb-section-dark">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="nb-sticker nb-sticker-coral mb-6 inline-flex">
            <span>CLI Tool</span>
          </div>
          <h2 className="font-bold text-3xl sm:text-4xl tracking-tight mb-3 uppercase">
            Capture. Replay. Test.
          </h2>
          <p className="text-base text-[var(--nb-text-muted)] max-w-2xl mx-auto">
            A powerful CLI for local webhook development. Capture real webhooks,
            replay them on demand, and test your handlers.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="nb-terminal">
            <div className="nb-terminal-header">
              <div className="nb-terminal-dot nb-terminal-dot-red" />
              <div className="nb-terminal-dot nb-terminal-dot-yellow" />
              <div className="nb-terminal-dot nb-terminal-dot-green" />
              <span className="nb-terminal-title">Terminal</span>
            </div>
            <div className="nb-terminal-body h-64 sm:h-80 overflow-y-auto overflow-x-auto">
              {visibleLines.map((line, index) => (
                <div key={index} className="leading-relaxed">
                  {!line ? (
                    <span>&nbsp;</span>
                  ) : line.startsWith("$ ") ? (
                    <>
                      <span className="text-[var(--nb-green)]">$ </span>
                      <span className="text-white font-bold">
                        {line.slice(2)}
                      </span>
                    </>
                  ) : line.startsWith("\u2713") ? (
                    <span className="text-[var(--nb-green)]">{line}</span>
                  ) : line.includes("http://") || line.includes("ws://") ? (
                    <span className="text-[var(--nb-blue)]">{line}</span>
                  ) : line.startsWith("\u{1F3A3}") ||
                    line.startsWith("\u{1F504}") ||
                    line.startsWith("\u{1F680}") ||
                    line.startsWith("\u{1F4E5}") ||
                    line.startsWith("\u{1F4DA}") ? (
                    <span className="text-white">{line}</span>
                  ) : (
                    <span className="text-[#666]">{line}</span>
                  )}
                </div>
              ))}
              <div className="text-[var(--nb-green)] nb-cursor-blink">
                &#9609;
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {cliFeatures.map((feature) => (
              <div key={feature.title} className="nb-card-flat p-4 group">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center border-2 flex-shrink-0"
                    style={{ borderColor: feature.color, color: feature.color }}
                  >
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base mb-1 group-hover:text-[var(--nb-coral)] transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[var(--nb-text-muted)] mb-2">
                      {feature.description}
                    </p>
                    <code className="text-xs font-mono text-[var(--nb-text-muted)] bg-[var(--nb-cream)] px-2.5 py-1 border border-[var(--nb-border-color)] inline-block max-w-full overflow-x-auto">
                      {feature.command}
                    </code>
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-3">
              <Link href="/docs/cli" className="nb-btn nb-btn-secondary w-full">
                CLI Documentation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="font-bold text-xs uppercase tracking-widest text-[var(--nb-text-muted)] mb-3">
            Install with Homebrew
          </p>
          <code className="inline-block px-4 py-2.5 bg-[#0a0a0a] border-2 border-[var(--nb-border-color)] font-mono text-xs sm:text-sm text-[#e0e0e0] max-w-full overflow-x-auto">
            <span className="text-[var(--nb-green)]">$</span>{" "}
            <span className="text-white">
              brew install --cask endalk200/tap/better-webhook
            </span>
          </code>
        </div>
      </div>
    </section>
  );
}
