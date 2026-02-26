import Link from "next/link";
import { Github, Download, BookOpen } from "lucide-react";

const footerLinks = {
  cli: [
    { name: "CLI Overview", href: "/docs/cli" },
    { name: "Command Reference", href: "/docs/cli/commands" },
    { name: "Configuration", href: "/docs/cli/configuration" },
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
    { name: "GCP Functions", href: "/docs/sdk/adapters#gcp-cloud-functions" },
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
      href: "https://github.com/endalk200/better-webhook/commits/main",
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
  {
    name: "@better-webhook/gcp-functions",
    href: "https://www.npmjs.com/package/@better-webhook/gcp-functions",
  },
];

export function Footer() {
  return (
    <footer className="border-t-[2.5px] border-[var(--nb-border-color)] bg-[var(--nb-white)]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-base mb-3">
              <span
                className="inline-flex items-center justify-center w-7 h-7 text-sm border-2 border-current"
                style={{ boxShadow: "2px 2px 0 currentColor" }}
              >
                &gt;_
              </span>
              <span>better-webhook</span>
            </div>
            <p className="text-sm text-[var(--nb-text-muted)] mb-3">
              Local-first webhook toolkit for capture, replay, and type-safe
              handlers.
            </p>
            <div className="flex gap-2">
              {[
                {
                  icon: Github,
                  href: "https://github.com/endalk200/better-webhook",
                  label: "GitHub",
                },
                {
                  icon: Download,
                  href: "https://github.com/endalk200/better-webhook/releases",
                  label: "Releases",
                },
                { icon: BookOpen, href: "/docs", label: "Docs", internal: true },
              ].map((item) => {
                const Wrapper = item.internal ? Link : "a";
                const extraProps = item.internal
                  ? {}
                  : { target: "_blank", rel: "noopener noreferrer" };
                return (
                  <Wrapper
                    key={item.label}
                    href={item.href}
                    className="w-8 h-8 flex items-center justify-center border-2 border-[var(--nb-border-color)] bg-[var(--nb-cream)] hover:bg-[var(--nb-yellow)] transition-colors"
                    title={item.label}
                    {...extraProps}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                  </Wrapper>
                );
              })}
            </div>
          </div>

          {[
            {
              title: "CLI",
              links: footerLinks.cli,
              color: "var(--nb-coral)",
            },
            {
              title: "SDK",
              links: footerLinks.sdk,
              color: "var(--nb-blue)",
            },
            { title: "Frameworks", links: footerLinks.frameworks },
            { title: "Resources", links: footerLinks.resources },
          ].map((col) => (
            <div key={col.title}>
              <h4
                className="font-bold text-xs uppercase tracking-widest mb-3"
                style={{ color: col.color || "var(--nb-text-muted)" }}
              >
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => {
                  const isExternal = "external" in link && link.external;
                  if (isExternal) {
                    return (
                      <li key={link.name}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--nb-text-muted)] hover:text-[var(--nb-coral)] transition-colors inline-flex items-center gap-1"
                        >
                          {link.name}
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
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--nb-text-muted)] hover:text-[var(--nb-coral)] transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t-[2.5px] border-[var(--nb-border-color)] pt-6 mb-6">
          <h4 className="font-bold text-xs uppercase tracking-widest mb-3 text-[var(--nb-text-muted)]">
            SDK Packages
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {packages.map((pkg) => (
              <a
                key={pkg.name}
                href={pkg.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono px-2.5 py-1 border-2 border-[var(--nb-border-color)] text-[var(--nb-text-muted)] hover:bg-[var(--nb-yellow)] hover:text-[var(--nb-black)] transition-colors"
              >
                {pkg.name}
              </a>
            ))}
          </div>
        </div>

        <div className="border-t-[2.5px] border-[var(--nb-border-color)] pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-[var(--nb-text-muted)] font-mono">
            MIT License &copy; {new Date().getFullYear()}{" "}
            <a
              href="https://github.com/endalk200"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--nb-coral)]"
            >
              Endalk
            </a>
          </p>
          <p className="text-xs text-[var(--nb-text-muted)]">
            Built for developers shipping webhook integrations
          </p>
        </div>
      </div>
    </footer>
  );
}
