import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Space_Mono, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://better-webhook.com"),
  title: {
    default: "better-webhook — Type-Safe Webhook SDK",
    template: "%s | better-webhook",
  },
  description:
    "Type-safe webhooks in TypeScript with schema validation, signature verification, and framework adapters.",
  keywords: [
    "webhook",
    "typescript",
    "development",
    "github",
    "ragie",
    "recall",
    "recall.ai",
    "nextjs",
    "express",
  ],
  authors: [{ name: "Endalk", url: "https://github.com/endalk200" }],
  creator: "Endalk",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://better-webhook.com",
    title: "better-webhook — Type-Safe Webhook SDK",
    description:
      "Type-safe webhooks in TypeScript with schema validation and signature verification.",
    siteName: "better-webhook",
  },
  twitter: {
    card: "summary_large_image",
    title: "better-webhook — Type-Safe Webhook SDK",
    description:
      "Type-safe webhooks in TypeScript with schema validation and signature verification.",
    creator: "@endalk200",
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceMono.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen antialiased">
        <RootProvider
          theme={{
            defaultTheme: "light",
            enableSystem: false,
          }}
        >
          {children}
        </RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
