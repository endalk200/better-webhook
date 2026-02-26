import {
  Hero,
  Marquee,
  QuickStart,
  Features,
  CLISection,
  SDKSection,
  CodeComparison,
  ProviderShowcase,
  Footer,
} from "./components";

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      <Hero />
      <Marquee />
      <QuickStart />
      <Features />
      <CLISection />
      <SDKSection />
      <CodeComparison />
      <ProviderShowcase />
      <Footer />
    </main>
  );
}
