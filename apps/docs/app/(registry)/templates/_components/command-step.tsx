"use client";

import type { TemplateMetadata, ProviderInfo } from "@/lib/templates";
import { CommandBlock } from "./command-block";
import { Download, Play, KeyRound, ExternalLink } from "lucide-react";

interface CommandStepProps {
  template: TemplateMetadata;
  provider: ProviderInfo;
}

export function CommandStep({ template, provider }: CommandStepProps) {
  return (
    <div className="nb-slide-in">
      <p className="text-sm text-[var(--nb-text-muted)] mb-2">
        Run these commands for{" "}
        <span className="font-bold text-[var(--nb-text)]">{template.name}</span>
        .
      </p>
      <p className="text-xs text-[var(--nb-text-muted)] mb-8 max-w-2xl leading-relaxed">
        {template.description}
      </p>

      <div className="space-y-6">
        <CommandBlock
          stepNumber={1}
          label="Download template"
          description="Download the webhook payload template to your local machine."
          icon={<Download className="w-3 h-3" />}
          command={`better-webhook templates download ${template.id}`}
        />

        <CommandBlock
          stepNumber={2}
          label="Run template"
          description="Send the webhook payload to your local development server."
          icon={<Play className="w-3 h-3" />}
          command={`better-webhook templates run ${template.id}`}
        />

        <CommandBlock
          stepNumber={3}
          label="Run with secret"
          description="Send with signature verification for production-like testing."
          icon={<KeyRound className="w-3 h-3" />}
          command={`better-webhook templates run ${template.id} --secret your_webhook_secret`}
        />
      </div>

      {template.docsUrl && (
        <a
          href={template.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="nb-btn nb-btn-ghost mt-8 text-xs inline-flex"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View Provider Docs
        </a>
      )}
    </div>
  );
}
