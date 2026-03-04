"use client";

import { useState, useMemo, useCallback } from "react";
import type { TemplateMetadata, ProviderInfo } from "@/lib/templates";
import { getEventsForProvider, groupEventsByCategory } from "@/lib/templates";
import { WorkflowStepper, type StepId } from "./workflow-stepper";
import { ProviderStep } from "./provider-step";
import { EventStep } from "./event-step";
import { CommandStep } from "./command-step";
import { ArrowLeft, RotateCcw, ChevronRight } from "lucide-react";

interface WorkflowBoardProps {
  templates: TemplateMetadata[];
  providers: ProviderInfo[];
}

export function WorkflowBoard({ templates, providers }: WorkflowBoardProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(
    null,
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateMetadata | null>(null);

  const currentStep: StepId = selectedTemplate
    ? "commands"
    : selectedProvider
      ? "event"
      : "provider";

  const providerTemplates = useMemo(() => {
    if (!selectedProvider) return [];
    return getEventsForProvider(templates, selectedProvider.slug);
  }, [templates, selectedProvider]);

  const eventGroups = useMemo(() => {
    return groupEventsByCategory(providerTemplates);
  }, [providerTemplates]);

  const handleProviderSelect = useCallback((provider: ProviderInfo) => {
    setSelectedProvider(provider);
    setSelectedTemplate(null);
  }, []);

  const handleEventSelect = useCallback((template: TemplateMetadata) => {
    setSelectedTemplate(template);
  }, []);

  const handleStepNavigate = useCallback((step: StepId) => {
    if (step === "provider") {
      setSelectedProvider(null);
      setSelectedTemplate(null);
    } else if (step === "event") {
      setSelectedTemplate(null);
    }
  }, []);

  const handleBack = useCallback(() => {
    if (selectedTemplate) {
      setSelectedTemplate(null);
    } else if (selectedProvider) {
      setSelectedProvider(null);
    }
  }, [selectedTemplate, selectedProvider]);

  const handleReset = useCallback(() => {
    setSelectedProvider(null);
    setSelectedTemplate(null);
  }, []);

  return (
    <section className="bg-[var(--nb-white)] border-t-[2.5px] border-[var(--nb-border-color)] py-8 sm:py-12 px-4">
      <div className="container mx-auto">
        <WorkflowStepper
          currentStep={currentStep}
          onNavigate={handleStepNavigate}
        />

        <div className="flex items-center justify-between mt-5 mb-6">
          <div className="flex items-center gap-3">
            {currentStep !== "provider" && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--nb-text-muted)] hover:text-[var(--nb-text)] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            {currentStep !== "provider" && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[var(--nb-coral)] hover:opacity-80 transition-opacity"
              >
                <RotateCcw className="w-3 h-3" />
                Start over
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {selectedProvider && (
              <span className="nb-breadcrumb-pill">
                {selectedProvider.name}
              </span>
            )}
            {selectedProvider && selectedTemplate && (
              <ChevronRight className="w-3 h-3 text-[var(--nb-text-muted)]" />
            )}
            {selectedTemplate && (
              <span className="nb-breadcrumb-pill">
                {selectedTemplate.event}
              </span>
            )}
          </div>
        </div>

        {currentStep === "provider" && (
          <ProviderStep providers={providers} onSelect={handleProviderSelect} />
        )}

        {currentStep === "event" && selectedProvider && (
          <EventStep
            provider={selectedProvider}
            eventGroups={eventGroups}
            onSelect={handleEventSelect}
          />
        )}

        {currentStep === "commands" && selectedTemplate && selectedProvider && (
          <CommandStep
            template={selectedTemplate}
            provider={selectedProvider}
          />
        )}
      </div>
    </section>
  );
}
