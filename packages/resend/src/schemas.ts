import { z } from "zod";

const ResendTagsMapSchema = z.record(z.string(), z.string());

const ResendTagPairSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const ResendTagsSchema = z.union([
  ResendTagsMapSchema,
  z.array(ResendTagPairSchema),
]);

const ResendEmailEventDataSchema = z
  .object({
    broadcast_id: z.string().optional(),
    created_at: z.string(),
    email_id: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string(),
    template_id: z.string().optional(),
    tags: ResendTagsSchema.optional(),
  })
  .passthrough();

const ResendBounceSchema = z
  .object({
    diagnosticCode: z.array(z.string()).optional(),
    message: z.string(),
    subType: z.string(),
    type: z.string(),
  })
  .passthrough();

const ResendClickSchema = z
  .object({
    ipAddress: z.string(),
    link: z.string(),
    timestamp: z.string(),
    userAgent: z.string(),
  })
  .passthrough();

const ResendFailedSchema = z
  .object({
    reason: z.string(),
  })
  .passthrough();

const ResendSuppressedSchema = z
  .object({
    message: z.string(),
    type: z.string(),
  })
  .passthrough();

const ResendReceivedAttachmentSchema = z
  .object({
    id: z.string(),
    filename: z.string().nullable(),
    content_type: z.string(),
    content_disposition: z.string().nullable(),
    content_id: z.string().nullable(),
  })
  .passthrough();

const ResendReceivedEmailEventDataSchema = z
  .object({
    email_id: z.string(),
    created_at: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    bcc: z.array(z.string()).optional(),
    cc: z.array(z.string()).optional(),
    message_id: z.string(),
    subject: z.string(),
    attachments: z.array(ResendReceivedAttachmentSchema).optional(),
  })
  .passthrough();

const ResendContactEventDataSchema = z
  .object({
    id: z.string(),
    audience_id: z.string().optional(),
    segment_ids: z.array(z.string()),
    created_at: z.string(),
    updated_at: z.string(),
    email: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    unsubscribed: z.boolean(),
  })
  .passthrough();

const ResendDomainRecordSchema = z
  .object({
    record: z.string(),
    name: z.string(),
    type: z.string(),
    value: z.string(),
    ttl: z.string(),
    status: z.string(),
    priority: z.number().optional(),
  })
  .passthrough();

const ResendDomainEventDataSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    created_at: z.string(),
    region: z.string(),
    records: z.array(ResendDomainRecordSchema),
  })
  .passthrough();

function createResendEventSchema<
  TEventType extends string,
  TSchema extends z.ZodTypeAny,
>(eventType: TEventType, dataSchema: TSchema) {
  return z
    .object({
      type: z.literal(eventType),
      created_at: z.string(),
      data: dataSchema,
    })
    .passthrough();
}

/** Schema for Resend `email.sent` webhook envelopes. */
export const ResendEmailSentEventSchema = createResendEventSchema(
  "email.sent",
  ResendEmailEventDataSchema,
);

/** Schema for Resend `email.scheduled` webhook envelopes. */
export const ResendEmailScheduledEventSchema = createResendEventSchema(
  "email.scheduled",
  ResendEmailEventDataSchema,
);

/** Schema for Resend `email.delivered` webhook envelopes. */
export const ResendEmailDeliveredEventSchema = createResendEventSchema(
  "email.delivered",
  ResendEmailEventDataSchema,
);

/** Schema for Resend `email.delivery_delayed` webhook envelopes. */
export const ResendEmailDeliveryDelayedEventSchema = createResendEventSchema(
  "email.delivery_delayed",
  ResendEmailEventDataSchema,
);

/** Schema for Resend `email.complained` webhook envelopes. */
export const ResendEmailComplainedEventSchema = createResendEventSchema(
  "email.complained",
  ResendEmailEventDataSchema,
);

/** Schema for Resend `email.bounced` webhook envelopes with `data.bounce` details. */
export const ResendEmailBouncedEventSchema = createResendEventSchema(
  "email.bounced",
  ResendEmailEventDataSchema.extend({
    bounce: ResendBounceSchema,
  }),
);

/** Schema for Resend `email.opened` webhook envelopes. */
export const ResendEmailOpenedEventSchema = createResendEventSchema(
  "email.opened",
  ResendEmailEventDataSchema,
);

/** Schema for Resend `email.clicked` webhook envelopes with `data.click` details. */
export const ResendEmailClickedEventSchema = createResendEventSchema(
  "email.clicked",
  ResendEmailEventDataSchema.extend({
    click: ResendClickSchema,
  }),
);

/** Schema for Resend `email.received` metadata-only inbound webhook envelopes. */
export const ResendEmailReceivedEventSchema = createResendEventSchema(
  "email.received",
  ResendReceivedEmailEventDataSchema,
);

/** Schema for Resend `email.failed` webhook envelopes with `data.failed` details. */
export const ResendEmailFailedEventSchema = createResendEventSchema(
  "email.failed",
  ResendEmailEventDataSchema.extend({
    failed: ResendFailedSchema,
  }),
);

/** Schema for Resend `email.suppressed` webhook envelopes with `data.suppressed` details. */
export const ResendEmailSuppressedEventSchema = createResendEventSchema(
  "email.suppressed",
  ResendEmailEventDataSchema.extend({
    suppressed: ResendSuppressedSchema,
  }),
);

/** Schema for Resend `contact.created` webhook envelopes. */
export const ResendContactCreatedEventSchema = createResendEventSchema(
  "contact.created",
  ResendContactEventDataSchema,
);

/** Schema for Resend `contact.updated` webhook envelopes. */
export const ResendContactUpdatedEventSchema = createResendEventSchema(
  "contact.updated",
  ResendContactEventDataSchema,
);

/** Schema for Resend `contact.deleted` webhook envelopes. */
export const ResendContactDeletedEventSchema = createResendEventSchema(
  "contact.deleted",
  ResendContactEventDataSchema,
);

/** Schema for Resend `domain.created` webhook envelopes. */
export const ResendDomainCreatedEventSchema = createResendEventSchema(
  "domain.created",
  ResendDomainEventDataSchema,
);

/** Schema for Resend `domain.updated` webhook envelopes. */
export const ResendDomainUpdatedEventSchema = createResendEventSchema(
  "domain.updated",
  ResendDomainEventDataSchema,
);

/** Schema for Resend `domain.deleted` webhook envelopes. */
export const ResendDomainDeletedEventSchema = createResendEventSchema(
  "domain.deleted",
  ResendDomainEventDataSchema,
);

/** Type inferred from `ResendEmailSentEventSchema`. */
export type ResendEmailSentEvent = z.infer<typeof ResendEmailSentEventSchema>;
/** Type inferred from `ResendEmailScheduledEventSchema`. */
export type ResendEmailScheduledEvent = z.infer<
  typeof ResendEmailScheduledEventSchema
>;
/** Type inferred from `ResendEmailDeliveredEventSchema`. */
export type ResendEmailDeliveredEvent = z.infer<
  typeof ResendEmailDeliveredEventSchema
>;
/** Type inferred from `ResendEmailDeliveryDelayedEventSchema`. */
export type ResendEmailDeliveryDelayedEvent = z.infer<
  typeof ResendEmailDeliveryDelayedEventSchema
>;
/** Type inferred from `ResendEmailComplainedEventSchema`. */
export type ResendEmailComplainedEvent = z.infer<
  typeof ResendEmailComplainedEventSchema
>;
/** Type inferred from `ResendEmailBouncedEventSchema`. */
export type ResendEmailBouncedEvent = z.infer<
  typeof ResendEmailBouncedEventSchema
>;
/** Type inferred from `ResendEmailOpenedEventSchema`. */
export type ResendEmailOpenedEvent = z.infer<
  typeof ResendEmailOpenedEventSchema
>;
/** Type inferred from `ResendEmailClickedEventSchema`. */
export type ResendEmailClickedEvent = z.infer<
  typeof ResendEmailClickedEventSchema
>;
/** Type inferred from `ResendEmailReceivedEventSchema`. */
export type ResendEmailReceivedEvent = z.infer<
  typeof ResendEmailReceivedEventSchema
>;
/** Type inferred from `ResendEmailFailedEventSchema`. */
export type ResendEmailFailedEvent = z.infer<
  typeof ResendEmailFailedEventSchema
>;
/** Type inferred from `ResendEmailSuppressedEventSchema`. */
export type ResendEmailSuppressedEvent = z.infer<
  typeof ResendEmailSuppressedEventSchema
>;

/** Type inferred from `ResendContactCreatedEventSchema`. */
export type ResendContactCreatedEvent = z.infer<
  typeof ResendContactCreatedEventSchema
>;
/** Type inferred from `ResendContactUpdatedEventSchema`. */
export type ResendContactUpdatedEvent = z.infer<
  typeof ResendContactUpdatedEventSchema
>;
/** Type inferred from `ResendContactDeletedEventSchema`. */
export type ResendContactDeletedEvent = z.infer<
  typeof ResendContactDeletedEventSchema
>;

/** Type inferred from `ResendDomainCreatedEventSchema`. */
export type ResendDomainCreatedEvent = z.infer<
  typeof ResendDomainCreatedEventSchema
>;
/** Type inferred from `ResendDomainUpdatedEventSchema`. */
export type ResendDomainUpdatedEvent = z.infer<
  typeof ResendDomainUpdatedEventSchema
>;
/** Type inferred from `ResendDomainDeletedEventSchema`. */
export type ResendDomainDeletedEvent = z.infer<
  typeof ResendDomainDeletedEventSchema
>;
