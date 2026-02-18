import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "better-webhook - Local-first Webhook Development Toolkit",
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
    "stripe",
    "nextjs",
    "express",
  ],
  authors: [{ name: "Endalk", url: "https://github.com/endalk200" }],
  creator: "Endalk",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://better-webhook.dev",
    title: "better-webhook - Local-first Webhook Development Toolkit",
    description:
      "Type-safe webhooks in TypeScript. Capture, replay, and test webhooks locally.",
    siteName: "better-webhook",
  },
  twitter: {
    card: "summary_large_image",
    title: "better-webhook - Local-first Webhook Development Toolkit",
    description:
      "Type-safe webhooks in TypeScript. Capture, replay, and test webhooks locally.",
    creator: "@endalk200",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen font-sans antialiased">
        <RootProvider>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
