"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CommandBlockProps {
  label: string;
  description: string;
  command: string;
  stepNumber: number;
  icon: React.ReactNode;
}

export function CommandBlock({
  label,
  description,
  command,
  stepNumber,
  icon,
}: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can fail in non-secure contexts or denied permissions.
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <div
          className="nb-step-number w-7 h-7 text-xs"
          style={{
            boxShadow: "none",
            border: "2px solid var(--nb-border-color)",
          }}
        >
          {stepNumber}
        </div>
        <span className="flex items-center gap-1.5 font-bold text-sm">
          {icon}
          {label}
        </span>
      </div>
      <p className="text-xs text-[var(--nb-text-muted)] mb-2 pl-[2.4rem]">
        {description}
      </p>
      <div className="nb-install">
        <div className="nb-install-text">
          <span className="text-[var(--nb-green)]">$</span>{" "}
          <span>{command}</span>
        </div>
        <button
          onClick={handleCopy}
          className="nb-install-btn"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-[var(--nb-green)]" />
          ) : (
            <Copy className="w-4 h-4 text-[var(--nb-text-muted)]" />
          )}
        </button>
      </div>
    </div>
  );
}
