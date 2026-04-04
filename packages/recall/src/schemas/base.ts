import { z } from "zod";

export const MetadataSchema = z.object({}).passthrough();

export const RecallResourceSchema = z
  .object({
    id: z.string(),
    metadata: MetadataSchema.optional(),
  })
  .passthrough();

export const RecallTimestampSchema = z
  .object({
    absolute: z.string(),
    relative: z.number(),
  })
  .passthrough();

export const RecallParticipantSchema = z
  .object({
    id: z.number(),
    name: z.string().nullable(),
    is_host: z.boolean(),
    platform: z.string().nullable(),
    extra_data: MetadataSchema,
    email: z.string().nullable(),
  })
  .passthrough();

export const RecallStatusDataSchema = z
  .object({
    code: z.string(),
    sub_code: z.string().nullable(),
    updated_at: z.string(),
  })
  .passthrough();
