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
    default: "better-webhook — Local-first Webhook Development Toolkit",
    template: "%s | better-webhook",
  },
  description:
    "Type-safe webhooks in TypeScript. Capture, replay, and test webhooks locally with a beautiful CLI and SDK.",
  keywords: [
    "webhook",
    "typescript",
    "cli",
    "testing",
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
    title: "better-webhook — Local-first Webhook Development Toolkit",
    description:
      "Type-safe webhooks in TypeScript. Capture, replay, and test webhooks locally.",
    siteName: "better-webhook",
  },
  twitter: {
    card: "summary_large_image",
    title: "better-webhook — Local-first Webhook Development Toolkit",
    description:
      "Type-safe webhooks in TypeScript. Capture, replay, and test webhooks locally.",
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
