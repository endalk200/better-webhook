type HomepageProvider = {
  key: string;
  name: string;
  package: string;
  sampleEvents: string[];
  totalEvents?: number;
  bgColor: string;
  accentColor: string;
  isCustom?: boolean;
};

export const homepageProviders = [
  {
    key: "github",
    name: "GitHub",
    package: "@better-webhook/github",
    sampleEvents: [
      "push",
      "pull_request",
      "issues",
      "installation",
      "installation_repositories",
    ],
    totalEvents: 5,
    bgColor: "#24292e",
    accentColor: "var(--nb-coral)",
  },
  {
    key: "ragie",
    name: "Ragie",
    package: "@better-webhook/ragie",
    sampleEvents: [
      "document_status_updated",
      "document_deleted",
      "entity_extracted",
      "connection_sync_started",
      "connection_sync_progress",
      "connection_sync_finished",
    ],
    totalEvents: 8,
    bgColor: "#0d9488",
    accentColor: "var(--nb-green)",
  },
  {
    key: "stripe",
    name: "Stripe",
    package: "@better-webhook/stripe",
    sampleEvents: [
      "charge.failed",
      "checkout.session.completed",
      "payment_intent.succeeded",
    ],
    totalEvents: 3,
    bgColor: "#635bff",
    accentColor: "var(--nb-yellow)",
  },
  {
    key: "recall",
    name: "Recall.ai",
    package: "@better-webhook/recall",
    sampleEvents: [
      "participant_events.join",
      "participant_events.leave",
      "participant_events.chat_message",
      "transcript.data",
      "transcript.partial_data",
      "bot.joining_call",
      "bot.done",
      "bot.fatal",
    ],
    totalEvents: 25,
    bgColor: "#4f46e5",
    accentColor: "var(--nb-blue)",
  },
  {
    key: "resend",
    name: "Resend",
    package: "@better-webhook/resend",
    sampleEvents: [
      "email.delivered",
      "email.bounced",
      "email.received",
      "domain.updated",
      "contact.created",
    ],
    totalEvents: 17,
    bgColor: "#111827",
    accentColor: "var(--nb-green)",
  },
  {
    key: "custom",
    name: "Custom",
    package: "@better-webhook/core",
    sampleEvents: ["any.event", "you.define"],
    bgColor: "transparent",
    accentColor: "var(--nb-lavender)",
    isCustom: true,
  },
] satisfies HomepageProvider[];
