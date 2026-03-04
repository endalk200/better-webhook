import type { Metadata } from "next";
import { getProviders } from "@/lib/templates";
import { getTemplates } from "@/lib/templates.server";
import { RegistryHero } from "./_components/registry-hero";
import { WorkflowBoard } from "./_components/workflow-board";
import { Footer } from "@/app/(home)/components/footer";

export const metadata: Metadata = {
  title: "Template Registry",
  description:
    "Browse, download, and run webhook payload templates for GitHub, Ragie, Recall.ai, and more. Test your webhook handlers with realistic payloads.",
};

export default function TemplatesPage() {
  const templates = getTemplates();
  const providers = getProviders(templates);

  return (
    <main className="flex flex-col min-h-screen">
      <RegistryHero totalTemplates={templates.length} providers={providers} />
      <WorkflowBoard templates={templates} providers={providers} />
      <Footer />
    </main>
  );
}
