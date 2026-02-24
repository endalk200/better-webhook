import Link from "next/link";
import { Github, Download, BookOpen } from "lucide-react";

const footerLinks = {
  cli: [
    { name: "CLI Overview", href: "/docs/cli" },
    { name: "Command Reference", href: "/docs/cli/commands" },
    { name: "Templates", href: "/docs/cli/templates" },
  ],
  sdk: [
    { name: "SDK Overview", href: "/docs/sdk" },
    { name: "Providers", href: "/docs/sdk/providers" },
    { name: "Adapters", href: "/docs/sdk/adapters" },
    { name: "Custom Providers", href: "/docs/sdk/custom-providers" },
  ],
  frameworks: [
    { name: "Next.js", href: "/docs/sdk/adapters#nextjs" },
    { name: "Hono", href: "/docs/sdk/adapters#hono" },
    { name: "Express", href: "/docs/sdk/adapters#express" },
    { name: "NestJS", href: "/docs/sdk/adapters#nestjs" },
  ],
  resources: [
    {
      name: "GitHub",
      href: "https://github.com/endalk200/better-webhook",
      external: true,
    },
    {
      name: "Releases",
      href: "https://github.com/endalk200/better-webhook/releases",
      external: true,
    },
    {
      name: "Changelog",
      href: "https://github.com/endalk200/better-webhook/releases",
      external: true,
    },
    {
      name: "Issues",
      href: "https://github.com/endalk200/better-webhook/issues",
      external: true,
    },
  ],
};

const packages = [
  {
    name: "@better-webhook/core",
    href: "https://www.npmjs.com/package/@better-webhook/core",
  },
  {
    name: "@better-webhook/github",
    href: "https://www.npmjs.com/package/@better-webhook/github",
  },
  {
    name: "@better-webhook/ragie",
    href: "https://www.npmjs.com/package/@better-webhook/ragie",
  },
  {
    name: "@better-webhook/recall",
    href: "https://www.npmjs.com/package/@better-webhook/recall",
  },
  {
    name: "@better-webhook/nextjs",
    href: "https://www.npmjs.com/package/@better-webhook/nextjs",
  },
  {
    name: "@better-webhook/express",
    href: "https://www.npmjs.com/package/@better-webhook/express",
  },
  {
    name: "@better-webhook/nestjs",
    href: "https://www.npmjs.com/package/@better-webhook/nestjs",
  },
  {
    name: "@better-webhook/hono",
    href: "https://www.npmjs.com/package/@better-webhook/hono",
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--lyra-border)] bg-[var(--lyra-bg-secondary)]">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-mono font-bold text-lg mb-4">
              <span className="text-[var(--lyra-primary)]">&gt;_</span>
              <span>better-webhook</span>
            </div>
            <p className="text-sm text-[var(--lyra-text-secondary)] mb-4">
              Local-first webhook toolkit. Type-safe, secure, and delightful.
            </p>
            <div className="flex gap-2">
              <a
                href="https://github.com/endalk200/better-webhook"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-[var(--lyra-border)] hover:border-[var(--lyra-primary)] transition-colors"
                title="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/endalk200/better-webhook/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-[var(--lyra-border)] hover:border-[var(--lyra-primary)] transition-colors"
                title="Releases"
              >
                <Download className="w-4 h-4" />
              </a>
              <Link
                href="/docs"
                className="p-2 border border-[var(--lyra-border)] hover:border-[var(--lyra-primary)] transition-colors"
                title="Documentation"
              >
                <BookOpen className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* CLI */}
          <div>
            <h4 className="font-mono font-semibold text-sm uppercase tracking-wider mb-4 text-[var(--lyra-primary)]">
              CLI
            </h4>
            <ul className="space-y-2">
              {footerLinks.cli.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--lyra-text-secondary)] hover:text-[var(--lyra-text)] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SDK */}
          <div>
            <h4 className="font-mono font-semibold text-sm uppercase tracking-wider mb-4 text-[var(--lyra-accent)]">
              SDK
            </h4>
            <ul className="space-y-2">
              {footerLinks.sdk.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--lyra-text-secondary)] hover:text-[var(--lyra-text)] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Frameworks */}
          <div>
            <h4 className="font-mono font-semibold text-sm uppercase tracking-wider mb-4 text-[var(--lyra-text-muted)]">
              Frameworks
            </h4>
            <ul className="space-y-2">
              {footerLinks.frameworks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--lyra-text-secondary)] hover:text-[var(--lyra-text)] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-mono font-semibold text-sm uppercase tracking-wider mb-4 text-[var(--lyra-text-muted)]">
              Resources
            </h4>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-[var(--lyra-text-secondary)] hover:text-[var(--lyra-text)] transition-colors inline-flex items-center gap-1"
                  >
                    {link.name}
                    {link.external && (
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Packages */}
        <div className="border-t border-[var(--lyra-border)] pt-8 mb-8">
          <h4 className="font-mono font-semibold text-xs uppercase tracking-wider mb-4 text-[var(--lyra-text-muted)]">
            SDK Packages
          </h4>
          <div className="flex flex-wrap gap-2">
            {packages.map((pkg) => (
              <a
                key={pkg.name}
                href={pkg.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono px-3 py-1.5 border border-[var(--lyra-border)] text-[var(--lyra-text-secondary)] hover:border-[var(--lyra-primary)] hover:text-[var(--lyra-primary)] transition-colors"
              >
                {pkg.name}
              </a>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-[var(--lyra-border)] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-[var(--lyra-text-muted)] font-mono">
            MIT License © {new Date().getFullYear()}{" "}
            <a
              href="https://github.com/endalk200"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--lyra-text)]"
            >
              Endalk
            </a>
          </p>
          <p className="text-xs text-[var(--lyra-text-muted)] font-mono">
            Built for developers who love webhooks
          </p>
        </div>
      </div>
    </footer>
  );
}
