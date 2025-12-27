"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

const beforeCode = `// The old way - manual and error-prone

app.post('/webhooks/github', async (req, res) => {
  // Manual signature verification
  const signature = req.headers['x-hub-signature-256'];
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  if (signature !== digest) {
    return res.status(401).send('Invalid signature');
  }
  
  // No types - hope the payload is correct!
  const event = req.headers['x-github-event'];
  
  if (event === 'push') {
    // TypeScript has no idea what's in here
    const repo = req.body.repository?.name;
    const commits = req.body.commits || [];
    // ...more manual parsing
  }
  
  res.status(200).send('OK');
});`;

const afterCode = `// The better-webhook way - type-safe and secure

import { github } from "@better-webhook/github";
import { toExpress } from "@better-webhook/express";

const webhook = github()
  .event("push", async (payload) => {
    // Full autocomplete and type safety!
    console.log(payload.repository.name);
    console.log(payload.commits.length);
    
    for (const commit of payload.commits) {
      console.log(commit.message);
    }
  })
  .onError((error, context) => {
    logger.error(\`Failed: \${context.eventType}\`, error);
  });

app.post('/webhooks/github',
  express.raw({ type: 'application/json' }),
  toExpress(webhook)
);`;

const comparisonPoints = [
  {
    before: "Manual HMAC signature verification",
    after: "Automatic signature verification",
  },
  { before: "No TypeScript support", after: "Full type inference with Zod" },
  { before: "Error-prone payload parsing", after: "Schema-validated payloads" },
  { before: "Boilerplate error handling", after: "Built-in error hooks" },
  { before: "30+ lines of code", after: "~15 lines of code" },
];

export function CodeComparison() {
  const [activeTab, setActiveTab] = useState<"before" | "after">("after");

  return (
    <section className="lyra-section">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold font-mono mb-4">
            See the <span className="gradient-text">difference</span>
          </h2>
          <p className="text-lg text-[var(--lyra-text-secondary)] max-w-2xl mx-auto">
            Compare traditional webhook handling with better-webhook. Less code,
            more safety, zero headaches.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center mb-8">
          <div className="lyra-tabs">
            <button
              onClick={() => setActiveTab("before")}
              className={`lyra-tab ${activeTab === "before" ? "active !bg-red-500" : ""}`}
            >
              <X className="w-3.5 h-3.5 inline-block mr-2" />
              Before
            </button>
            <button
              onClick={() => setActiveTab("after")}
              className={`lyra-tab ${activeTab === "after" ? "active" : ""}`}
            >
              <Check className="w-3.5 h-3.5 inline-block mr-2" />
              After
            </button>
          </div>
        </div>

        {/* Code Display */}
        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Code Block */}
          <div className="lg:col-span-3">
            <div
              className={`lyra-code-block transition-all duration-150 ${
                activeTab === "before"
                  ? "border-red-500/50"
                  : "border-[var(--lyra-accent)]/50"
              }`}
            >
              <div className="lyra-code-header">
                <div className="lyra-code-dot lyra-code-dot-red" />
                <div className="lyra-code-dot lyra-code-dot-yellow" />
                <div className="lyra-code-dot lyra-code-dot-green" />
                <span className="ml-3 text-xs text-[var(--lyra-text-muted)] font-mono">
                  {activeTab === "before" ? "webhook-handler.js" : "route.ts"}
                </span>
                <span
                  className={`ml-auto text-[10px] font-mono uppercase tracking-wider px-2 py-1 border ${
                    activeTab === "before"
                      ? "border-red-500/50 text-red-400"
                      : "border-[var(--lyra-accent)]/50 text-[var(--lyra-accent)]"
                  }`}
                >
                  {activeTab === "before" ? "Traditional" : "better-webhook"}
                </span>
              </div>
              <div className="lyra-code-body overflow-x-auto max-h-[500px]">
                <pre className="font-mono text-sm leading-relaxed">
                  <code>
                    <SimpleHighlight
                      key={activeTab}
                      code={activeTab === "before" ? beforeCode : afterCode}
                      isBefore={activeTab === "before"}
                    />
                  </code>
                </pre>
              </div>
            </div>
          </div>

          {/* Comparison Points */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-semibold font-mono text-sm uppercase tracking-wider text-[var(--lyra-text-muted)] mb-4">
              What changes
            </h3>
            {comparisonPoints.map((point, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-[var(--lyra-surface)] border border-[var(--lyra-border)]"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {activeTab === "before" ? (
                    <X className="w-4 h-4 text-red-500" />
                  ) : (
                    <Check className="w-4 h-4 text-[var(--lyra-accent)]" />
                  )}
                </div>
                <div>
                  <span
                    className={`text-sm ${
                      activeTab === "before"
                        ? "text-[var(--lyra-text-muted)] line-through"
                        : "text-[var(--lyra-text)]"
                    }`}
                  >
                    {activeTab === "before" ? point.before : point.after}
                  </span>
                </div>
              </div>
            ))}

            {/* Stats */}
            <div className="mt-6 p-4 bg-[var(--lyra-surface)] border border-[var(--lyra-accent)]/30">
              <div className="text-center">
                <div className="text-3xl font-bold font-mono text-[var(--lyra-accent)]">
                  50%
                </div>
                <div className="text-xs text-[var(--lyra-text-muted)] font-mono uppercase tracking-wider">
                  Less code
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SimpleHighlight({
  code,
  isBefore,
}: {
  code: string;
  isBefore: boolean;
}) {
  const lines = code.split("\n");

  return (
    <div className="inline-block min-w-full">
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span className="pr-4 text-gray-600 select-none text-right w-8 shrink-0 opacity-50">
            {i + 1}
          </span>
          <span className="whitespace-pre">
            <HighlightLine line={line} isBefore={isBefore} />
          </span>
        </div>
      ))}
    </div>
  );
}

function HighlightLine({
  line,
  isBefore,
}: {
  line: string;
  isBefore: boolean;
}) {
  // Comments
  if (line.trim().startsWith("//")) {
    const isGood =
      line.includes("Full") || line.includes("type") || line.includes("safety");
    const isBad =
      line.includes("manual") ||
      line.includes("No ") ||
      line.includes("hope") ||
      line.includes("old");
    return (
      <span
        className={
          isGood ? "text-emerald-400" : isBad ? "text-red-400" : "text-gray-500"
        }
      >
        {line}
      </span>
    );
  }

  return <span dangerouslySetInnerHTML={{ __html: highlightSyntax(line) }} />;
}

function highlightSyntax(line: string): string {
  // Escape HTML first
  let result = line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Use placeholder tokens to avoid nested replacements
  const tokens: { placeholder: string; html: string }[] = [];
  let tokenIndex = 0;

  // Extract and replace strings first (to avoid keyword matching inside strings)
  result = result.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, (match) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`;
    tokens.push({
      placeholder,
      html: `<span class="text-amber-400">${match}</span>`,
    });
    return placeholder;
  });

  // Keywords (only match outside of strings now)
  const keywords = [
    "import",
    "from",
    "const",
    "async",
    "await",
    "if",
    "export",
    "for",
    "return",
    "let",
    "var",
    "function",
  ];
  keywords.forEach((kw) => {
    const regex = new RegExp(`\\b(${kw})\\b`, "g");
    result = result.replace(regex, `<span class="text-cyan-400">$1</span>`);
  });

  // Restore string tokens
  tokens.forEach(({ placeholder, html }) => {
    result = result.replace(placeholder, html);
  });

  return result;
}
