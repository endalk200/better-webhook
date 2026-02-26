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
      <div className="flex flex-col min-h-[calc(100dvh-3.5rem)]">
        <Hero />
        <Marquee />
      </div>
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
