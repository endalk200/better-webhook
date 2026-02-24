import {
  Hero,
  Features,
  CLISection,
  SDKSection,
  CodeComparison,
  ProviderShowcase,
  QuickStart,
  Footer,
} from "./components";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <Hero />

      {/* Quick Start Guide */}
      <QuickStart />

      {/* Features Grid */}
      <Features />

      {/* CLI Section - Dedicated showcase */}
      <CLISection />

      {/* SDK Section - Dedicated showcase */}
      <SDKSection />

      {/* Code Comparison - Before/After */}
      <CodeComparison />

      {/* Provider Showcase */}
      <ProviderShowcase />

      {/* Footer */}
      <Footer />
    </main>
  );
}
