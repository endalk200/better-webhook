"use client";

import type {
  TemplateMetadata,
  ProviderInfo,
  EventGroup,
} from "@/lib/templates";
import { ArrowRight } from "lucide-react";

interface EventStepProps {
  provider: ProviderInfo;
  eventGroups: EventGroup[];
  onSelect: (template: TemplateMetadata) => void;
}

export function EventStep({ provider, eventGroups, onSelect }: EventStepProps) {
  const hasCategories = eventGroups.some((g) => g.templates.length > 1);

  return (
    <div className="nb-slide-in">
      <p className="text-sm text-[var(--nb-text-muted)] mb-6">
        Choose an event from{" "}
        <span className="font-bold text-[var(--nb-text)]">{provider.name}</span>
        .
      </p>

      {hasCategories ? (
        <div className="space-y-8">
          {eventGroups.map((group) => (
            <div key={group.category}>
              {eventGroups.length > 1 && (
                <h3 className="font-bold text-xs uppercase tracking-widest text-[var(--nb-text-muted)] mb-3 flex items-center gap-2">
                  <span
                    className="w-2 h-2 inline-block"
                    style={{ background: provider.color }}
                  />
                  {group.category}
                </h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.templates.map((template) => (
                  <EventCard
                    key={template.id}
                    template={template}
                    accentColor={provider.color}
                    onSelect={() => onSelect(template)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {eventGroups.flatMap((g) =>
            g.templates.map((template) => (
              <EventCard
                key={template.id}
                template={template}
                accentColor={provider.color}
                onSelect={() => onSelect(template)}
              />
            )),
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({
  template,
  accentColor,
  onSelect,
}: {
  template: TemplateMetadata;
  accentColor: string;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="nb-workflow-card p-4" onClick={onSelect}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="font-bold text-sm uppercase tracking-tight"
          style={{ color: accentColor }}
        >
          {template.event}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-[var(--nb-text-muted)] flex-shrink-0 mt-0.5" />
      </div>
      <p className="text-xs text-[var(--nb-text-muted)] leading-relaxed line-clamp-2">
        {template.description}
      </p>
    </button>
  );
}
