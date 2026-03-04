"use client";

import { Check, ChevronRight } from "lucide-react";

export type StepId = "provider" | "event" | "commands";

interface Step {
  id: StepId;
  label: string;
  number: number;
}

const STEPS: Step[] = [
  { id: "provider", label: "Choose Provider", number: 1 },
  { id: "event", label: "Select Event", number: 2 },
  { id: "commands", label: "Run Commands", number: 3 },
];

interface WorkflowStepperProps {
  currentStep: StepId;
  onNavigate: (step: StepId) => void;
}

export function WorkflowStepper({
  currentStep,
  onNavigate,
}: WorkflowStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="nb-stepper">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isActive = step.id === currentStep;
        const isFuture = !isCompleted && !isActive;
        const state = isCompleted
          ? "completed"
          : isActive
            ? "active"
            : "future";

        return (
          <div
            key={step.id}
            className={`flex items-center${i === STEPS.length - 1 ? " flex-1" : ""}`}
          >
            <button
              type="button"
              className={`nb-stepper-step${i === STEPS.length - 1 ? " flex-1" : ""}`}
              data-state={state}
              disabled={isFuture}
              onClick={() => {
                if (isCompleted) onNavigate(step.id);
              }}
            >
              <span className="nb-stepper-step-number">
                {isCompleted ? <Check className="w-2.5 h-2.5" /> : step.number}
              </span>
              <span>{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight className="nb-stepper-chevron w-3.5 h-3.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}
