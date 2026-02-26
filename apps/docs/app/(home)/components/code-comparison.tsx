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
import { push } from "@better-webhook/github/events";
import { toExpress } from "@better-webhook/express";

const webhook = github()
  .event(push, async (payload) => {
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
  {
    before: "Manual verification flow setup",
    after: "Less boilerplate with adapters",
  },
];

export function CodeComparison() {
  const [activeTab, setActiveTab] = useState<"before" | "after">("after");

  return (
    <section className="nb-section bg-[var(--nb-white)]">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="font-bold text-3xl sm:text-4xl tracking-tight mb-3 uppercase">
            See the <span className="nb-highlight">difference</span>
          </h2>
          <p className="text-base text-[var(--nb-text-muted)] max-w-2xl mx-auto">
            Compare traditional webhook handling with better-webhook. Less
            boilerplate, more safety.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="nb-tabs">
            <button
              onClick={() => setActiveTab("before")}
              className={`nb-tab ${activeTab === "before" ? "active" : ""}`}
              style={
                activeTab === "before"
                  ? { background: "#dc2626", color: "#fff" }
                  : {}
              }
            >
              <X className="w-3.5 h-3.5 inline-block mr-2" />
              Before
            </button>
            <button
              onClick={() => setActiveTab("after")}
              className={`nb-tab ${activeTab === "after" ? "active" : ""}`}
              style={
                activeTab === "after"
                  ? { background: "var(--nb-green)", color: "#fff" }
                  : {}
              }
            >
              <Check className="w-3.5 h-3.5 inline-block mr-2" />
              After
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3">
            <div
              className="nb-code-block"
              style={{
                borderColor:
                  activeTab === "before"
                    ? "#dc2626"
                    : "var(--nb-green)",
              }}
            >
              <div className="nb-code-header">
                <div className="nb-terminal-dot nb-terminal-dot-red" />
                <div className="nb-terminal-dot nb-terminal-dot-yellow" />
                <div className="nb-terminal-dot nb-terminal-dot-green" />
                <span className="ml-3 text-xs text-[#666] font-mono">
                  {activeTab === "before" ? "webhook-handler.js" : "route.ts"}
                </span>
                <span
                  className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border-2"
                  style={{
                    borderColor:
                      activeTab === "before" ? "#dc2626" : "var(--nb-green)",
                    color:
                      activeTab === "before" ? "#dc2626" : "var(--nb-green)",
                  }}
                >
                  {activeTab === "before" ? "Traditional" : "better-webhook"}
                </span>
              </div>
              <div className="nb-code-body overflow-x-auto max-h-[500px]">
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

          <div className="lg:col-span-2 space-y-2.5">
            <h3 className="font-bold text-sm uppercase tracking-widest text-[var(--nb-text-muted)] mb-3">
              What changes
            </h3>
            {comparisonPoints.map((point, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 nb-card-flat"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {activeTab === "before" ? (
                    <div className="w-5 h-5 flex items-center justify-center bg-red-600 text-white">
                      <X className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 flex items-center justify-center bg-[var(--nb-green)] text-white">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <span
                  className={`text-sm ${
                    activeTab === "before"
                      ? "text-[var(--nb-text-muted)] line-through"
                      : "text-[var(--nb-text)]"
                  }`}
                >
                  {activeTab === "before" ? point.before : point.after}
                </span>
              </div>
            ))}

            <div
              className="mt-4 p-4 text-center nb-card"
              style={{
                borderColor: "var(--nb-green)",
                boxShadow: "5px 5px 0 var(--nb-green)",
              }}
            >
              <div
                className="text-2xl font-bold"
                style={{ color: "var(--nb-green)" }}
              >
                ~20%
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--nb-text-muted)]">
                Less boilerplate
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
          <span className="pr-4 text-[#444] select-none text-right w-8 shrink-0 opacity-50">
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
          isGood
            ? "text-emerald-400"
            : isBad
              ? "text-red-400"
              : "text-[#555]"
        }
      >
        {line}
      </span>
    );
  }

  return <span dangerouslySetInnerHTML={{ __html: highlightSyntax(line) }} />;
}

function highlightSyntax(line: string): string {
  let result = line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const tokens: { placeholder: string; html: string }[] = [];
  let tokenIndex = 0;

  result = result.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, (match) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`;
    tokens.push({
      placeholder,
      html: `<span class="text-amber-400">${match}</span>`,
    });
    return placeholder;
  });

  const kwRegex =
    /\b(import|from|const|async|await|if|export|for|return|let|var|function)\b/g;
  result = result.replace(kwRegex, (match) => {
    const placeholder = `__TOKEN_${tokenIndex++}__`;
    tokens.push({
      placeholder,
      html: `<span style="color:var(--nb-coral)">${match}</span>`,
    });
    return placeholder;
  });

  tokens.forEach(({ placeholder, html }) => {
    result = result.replace(placeholder, html);
  });

  return result;
}
