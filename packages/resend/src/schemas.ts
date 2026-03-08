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

export const ResendEmailSentEventSchema = createResendEventSchema(
  "email.sent",
  ResendEmailEventDataSchema,
);

export const ResendEmailScheduledEventSchema = createResendEventSchema(
  "email.scheduled",
  ResendEmailEventDataSchema,
);

export const ResendEmailDeliveredEventSchema = createResendEventSchema(
  "email.delivered",
  ResendEmailEventDataSchema,
);

export const ResendEmailDeliveryDelayedEventSchema = createResendEventSchema(
  "email.delivery_delayed",
  ResendEmailEventDataSchema,
);

export const ResendEmailComplainedEventSchema = createResendEventSchema(
  "email.complained",
  ResendEmailEventDataSchema,
);

export const ResendEmailBouncedEventSchema = createResendEventSchema(
  "email.bounced",
  ResendEmailEventDataSchema.extend({
    bounce: ResendBounceSchema,
  }),
);

export const ResendEmailOpenedEventSchema = createResendEventSchema(
  "email.opened",
  ResendEmailEventDataSchema,
);

export const ResendEmailClickedEventSchema = createResendEventSchema(
  "email.clicked",
  ResendEmailEventDataSchema.extend({
    click: ResendClickSchema,
  }),
);

export const ResendEmailReceivedEventSchema = createResendEventSchema(
  "email.received",
  ResendReceivedEmailEventDataSchema,
);

export const ResendEmailFailedEventSchema = createResendEventSchema(
  "email.failed",
  ResendEmailEventDataSchema.extend({
    failed: ResendFailedSchema,
  }),
);

export const ResendEmailSuppressedEventSchema = createResendEventSchema(
  "email.suppressed",
  ResendEmailEventDataSchema.extend({
    suppressed: ResendSuppressedSchema,
  }),
);

export const ResendContactCreatedEventSchema = createResendEventSchema(
  "contact.created",
  ResendContactEventDataSchema,
);

export const ResendContactUpdatedEventSchema = createResendEventSchema(
  "contact.updated",
  ResendContactEventDataSchema,
);

export const ResendContactDeletedEventSchema = createResendEventSchema(
  "contact.deleted",
  ResendContactEventDataSchema,
);

export const ResendDomainCreatedEventSchema = createResendEventSchema(
  "domain.created",
  ResendDomainEventDataSchema,
);

export const ResendDomainUpdatedEventSchema = createResendEventSchema(
  "domain.updated",
  ResendDomainEventDataSchema,
);

export const ResendDomainDeletedEventSchema = createResendEventSchema(
  "domain.deleted",
  ResendDomainEventDataSchema,
);

export type ResendEmailSentEvent = z.infer<typeof ResendEmailSentEventSchema>;
export type ResendEmailScheduledEvent = z.infer<
  typeof ResendEmailScheduledEventSchema
>;
export type ResendEmailDeliveredEvent = z.infer<
  typeof ResendEmailDeliveredEventSchema
>;
export type ResendEmailDeliveryDelayedEvent = z.infer<
  typeof ResendEmailDeliveryDelayedEventSchema
>;
export type ResendEmailComplainedEvent = z.infer<
  typeof ResendEmailComplainedEventSchema
>;
export type ResendEmailBouncedEvent = z.infer<
  typeof ResendEmailBouncedEventSchema
>;
export type ResendEmailOpenedEvent = z.infer<
  typeof ResendEmailOpenedEventSchema
>;
export type ResendEmailClickedEvent = z.infer<
  typeof ResendEmailClickedEventSchema
>;
export type ResendEmailReceivedEvent = z.infer<
  typeof ResendEmailReceivedEventSchema
>;
export type ResendEmailFailedEvent = z.infer<
  typeof ResendEmailFailedEventSchema
>;
export type ResendEmailSuppressedEvent = z.infer<
  typeof ResendEmailSuppressedEventSchema
>;

export type ResendContactCreatedEvent = z.infer<
  typeof ResendContactCreatedEventSchema
>;
export type ResendContactUpdatedEvent = z.infer<
  typeof ResendContactUpdatedEventSchema
>;
export type ResendContactDeletedEvent = z.infer<
  typeof ResendContactDeletedEventSchema
>;

export type ResendDomainCreatedEvent = z.infer<
  typeof ResendDomainCreatedEventSchema
>;
export type ResendDomainUpdatedEvent = z.infer<
  typeof ResendDomainUpdatedEventSchema
>;
export type ResendDomainDeletedEvent = z.infer<
  typeof ResendDomainDeletedEventSchema
>;
