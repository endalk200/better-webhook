import { defineEvent } from "@better-webhook/core";
import {
  ResendContactCreatedEventSchema,
  ResendContactDeletedEventSchema,
  ResendContactUpdatedEventSchema,
  ResendDomainCreatedEventSchema,
  ResendDomainDeletedEventSchema,
  ResendDomainUpdatedEventSchema,
  ResendEmailBouncedEventSchema,
  ResendEmailClickedEventSchema,
  ResendEmailComplainedEventSchema,
  ResendEmailDeliveredEventSchema,
  ResendEmailDeliveryDelayedEventSchema,
  ResendEmailFailedEventSchema,
  ResendEmailOpenedEventSchema,
  ResendEmailReceivedEventSchema,
  ResendEmailScheduledEventSchema,
  ResendEmailSentEventSchema,
  ResendEmailSuppressedEventSchema,
} from "./schemas.js";

export type ResendProvider = "resend";

export const email_sent = defineEvent({
  name: "email.sent",
  schema: ResendEmailSentEventSchema,
  provider: "resend" as const,
});

export const email_scheduled = defineEvent({
  name: "email.scheduled",
  schema: ResendEmailScheduledEventSchema,
  provider: "resend" as const,
});

export const email_delivered = defineEvent({
  name: "email.delivered",
  schema: ResendEmailDeliveredEventSchema,
  provider: "resend" as const,
});

export const email_delivery_delayed = defineEvent({
  name: "email.delivery_delayed",
  schema: ResendEmailDeliveryDelayedEventSchema,
  provider: "resend" as const,
});

export const email_complained = defineEvent({
  name: "email.complained",
  schema: ResendEmailComplainedEventSchema,
  provider: "resend" as const,
});

export const email_bounced = defineEvent({
  name: "email.bounced",
  schema: ResendEmailBouncedEventSchema,
  provider: "resend" as const,
});

export const email_opened = defineEvent({
  name: "email.opened",
  schema: ResendEmailOpenedEventSchema,
  provider: "resend" as const,
});

export const email_clicked = defineEvent({
  name: "email.clicked",
  schema: ResendEmailClickedEventSchema,
  provider: "resend" as const,
});

export const email_received = defineEvent({
  name: "email.received",
  schema: ResendEmailReceivedEventSchema,
  provider: "resend" as const,
});

export const email_failed = defineEvent({
  name: "email.failed",
  schema: ResendEmailFailedEventSchema,
  provider: "resend" as const,
});

export const email_suppressed = defineEvent({
  name: "email.suppressed",
  schema: ResendEmailSuppressedEventSchema,
  provider: "resend" as const,
});

export const contact_created = defineEvent({
  name: "contact.created",
  schema: ResendContactCreatedEventSchema,
  provider: "resend" as const,
});

export const contact_updated = defineEvent({
  name: "contact.updated",
  schema: ResendContactUpdatedEventSchema,
  provider: "resend" as const,
});

export const contact_deleted = defineEvent({
  name: "contact.deleted",
  schema: ResendContactDeletedEventSchema,
  provider: "resend" as const,
});

export const domain_created = defineEvent({
  name: "domain.created",
  schema: ResendDomainCreatedEventSchema,
  provider: "resend" as const,
});

export const domain_updated = defineEvent({
  name: "domain.updated",
  schema: ResendDomainUpdatedEventSchema,
  provider: "resend" as const,
});

export const domain_deleted = defineEvent({
  name: "domain.deleted",
  schema: ResendDomainDeletedEventSchema,
  provider: "resend" as const,
});

export type {
  ResendContactCreatedEvent,
  ResendContactDeletedEvent,
  ResendContactUpdatedEvent,
  ResendDomainCreatedEvent,
  ResendDomainDeletedEvent,
  ResendDomainUpdatedEvent,
  ResendEmailBouncedEvent,
  ResendEmailClickedEvent,
  ResendEmailComplainedEvent,
  ResendEmailDeliveredEvent,
  ResendEmailDeliveryDelayedEvent,
  ResendEmailFailedEvent,
  ResendEmailOpenedEvent,
  ResendEmailReceivedEvent,
  ResendEmailScheduledEvent,
  ResendEmailSentEvent,
  ResendEmailSuppressedEvent,
} from "./schemas.js";
