export const metadata = {
  title: "Better Webhook - Next.js Example",
  description: "Example Next.js app demonstrating @better-webhook/nextjs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

