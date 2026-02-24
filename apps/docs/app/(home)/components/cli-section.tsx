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
      "📚 Captured webhooks:",
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
      "🎣 Webhook Capture Server",
      "   Listening on http://localhost:3001",
      "   Captures saved to: ~/.better-webhook/captures",
      "   Tip: Send webhooks to any path, e.g. http://localhost:3001/webhooks/github",
      "",
      "📥 Captured webhook from github",
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
      "🔄 Replaying Webhook",
      "",
      "   Capture ID: abc12345",
      "   Target: http://localhost:3000/api/webhooks/github",
      "",
      "📥 Response",
      "",
      "   Status: 200 OK",
      "   Duration: 45ms",
      "",
      "✓ Replay completed successfully",
    ],
    delay: 1200,
  },
  {
    prompt: "$ ",
    command:
      "better-webhook templates run github-push http://localhost:3000/api/webhooks/github",
    output: [
      "",
      "🚀 Executing Webhook",
      "",
      "   Template: github-push",
      "   Provider: github",
      "   Event: push",
      "   Signature: Will be generated",
      "",
      "📥 Response",
      "",
      "   Status: 200 OK",
      "   Duration: 38ms",
      "",
      "✓ Webhook delivered successfully",
    ],
    delay: 1000,
  },
];

const cliFeatures = [
  {
    icon: Radio,
    title: "Capture",
    description:
      "Start a local server to intercept and store incoming webhooks",
    command: "better-webhook capture",
  },
  {
    icon: RotateCcw,
    title: "Replay",
    description: "Re-send captured webhooks to any endpoint with full headers",
    command: "better-webhook captures replay <id> <url>",
  },
  {
    icon: FileCode,
    title: "Templates",
    description:
      "Download and run community templates for GitHub, Ragie, Recall.ai, and more",
    command: "better-webhook templates list",
  },
];

export function CLISection() {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [, setCurrentCommandIndex] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let lineIndex = 0;
    let commandIndex = 0;

    const typeNextLine = () => {
      if (commandIndex >= commands.length) {
        // Restart after a pause
        timeout = setTimeout(() => {
          setVisibleLines([]);
          commandIndex = 0;
          lineIndex = 0;
          setCurrentCommandIndex(0);
          typeNextLine();
        }, 4000);
        return;
      }

      const cmd = commands[commandIndex];

      if (lineIndex === 0) {
        // Type command
        setCurrentCommandIndex(commandIndex);
        setVisibleLines((prev) => [...prev, cmd.prompt + cmd.command]);
        lineIndex++;
        timeout = setTimeout(typeNextLine, cmd.delay);
      } else if (lineIndex <= cmd.output.length) {
        // Show output lines
        setVisibleLines((prev) => [...prev, cmd.output[lineIndex - 1]]);
        lineIndex++;
        timeout = setTimeout(typeNextLine, 60);
      } else {
        // Move to next command
        commandIndex++;
        lineIndex = 0;
        timeout = setTimeout(typeNextLine, 1500);
      }
    };

    typeNextLine();

    return () => clearTimeout(timeout);
  }, []);

  return (
    <section className="lyra-section lyra-section-dark">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="lyra-badge lyra-badge-primary mb-6">
            <span>CLI Tool</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold font-mono mb-4">
            <span className="text-white">Capture.</span>{" "}
            <span className="text-[var(--lyra-primary)]">Replay.</span>{" "}
            <span className="text-[var(--lyra-accent)]">Test.</span>
          </h2>
          <p className="text-lg text-[var(--lyra-text-secondary)] max-w-2xl mx-auto">
            A powerful CLI for local webhook development. Capture real webhooks,
            replay them on demand, and test your handlers without triggering
            external events.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Terminal Demo */}
          <div className="lyra-terminal shadow-2xl">
            <div className="lyra-terminal-header">
              <div className="lyra-code-dot lyra-code-dot-red" />
              <div className="lyra-code-dot lyra-code-dot-yellow" />
              <div className="lyra-code-dot lyra-code-dot-green" />
              <span className="lyra-terminal-title">Terminal</span>
            </div>
            <div className="lyra-terminal-body h-96 overflow-y-auto">
              {visibleLines.map((line, index) => (
                <div key={index} className="leading-relaxed">
                  {!line ? (
                    <span>&nbsp;</span>
                  ) : line.startsWith("$ ") ? (
                    <>
                      <span className="lyra-terminal-prompt">$ </span>
                      <span className="lyra-terminal-command">
                        {line.slice(2)}
                      </span>
                    </>
                  ) : line.startsWith("✓") || line.startsWith("✅") ? (
                    <span className="lyra-terminal-success">{line}</span>
                  ) : line.includes("http://") || line.includes("ws://") ? (
                    <span className="lyra-terminal-info">{line}</span>
                  ) : line.startsWith("🎣") ||
                    line.startsWith("🔄") ||
                    line.startsWith("🚀") ||
                    line.startsWith("📥") ? (
                    <span className="text-white">{line}</span>
                  ) : (
                    <span className="lyra-terminal-output">{line}</span>
                  )}
                </div>
              ))}
              <div className="lyra-terminal-prompt lyra-cursor-blink">▋</div>
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-4">
            {cliFeatures.map((feature, index) => (
              <div key={feature.title} className="lyra-feature-card group">
                <div className="flex items-start gap-4">
                  <div className="lyra-feature-icon">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold font-mono text-lg mb-1 text-white group-hover:text-[var(--lyra-primary)] transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[var(--lyra-text-secondary)] mb-2">
                      {feature.description}
                    </p>
                    <code className="text-xs font-mono text-[var(--lyra-text-muted)] bg-[#0a0a0a] px-2 py-1 border border-[var(--lyra-border)]">
                      {feature.command}
                    </code>
                  </div>
                </div>
              </div>
            ))}

            {/* CTA */}
            <div className="pt-4">
              <Link
                href="/docs/cli"
                className="lyra-btn lyra-btn-secondary inline-flex items-center gap-2 w-full justify-center"
              >
                CLI Documentation
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Install command */}
        <div className="mt-16 text-center">
          <p className="text-xs text-[var(--lyra-text-muted)] font-mono uppercase tracking-wider mb-4">
            Install with Homebrew
          </p>
          <code className="inline-block px-6 py-3 bg-[var(--lyra-surface)] border border-[var(--lyra-border)] font-mono text-sm">
            <span className="text-[var(--lyra-accent)]">$</span>{" "}
            <span className="text-white">
              brew install --cask endalk200/tap/better-webhook
            </span>
          </code>
        </div>
      </div>
    </section>
  );
}
