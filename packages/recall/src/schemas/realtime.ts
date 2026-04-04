import { z } from "zod";
import {
  MetadataSchema,
  RecallParticipantSchema,
  RecallResourceSchema,
  RecallTimestampSchema,
} from "./base.js";

function createParticipantEventSchema(dataSchema: z.ZodTypeAny) {
  return z
    .object({
      data: dataSchema,
      realtime_endpoint: RecallResourceSchema,
      participant_events: RecallResourceSchema,
      recording: RecallResourceSchema,
      bot: RecallResourceSchema.optional(),
    })
    .passthrough();
}

function createTranscriptEventSchema(dataSchema: z.ZodTypeAny) {
  return z
    .object({
      data: dataSchema,
      realtime_endpoint: RecallResourceSchema,
      transcript: RecallResourceSchema,
      recording: RecallResourceSchema,
      bot: RecallResourceSchema.optional(),
    })
    .passthrough();
}

const RecallParticipantEventDataSchema = z
  .object({
    participant: RecallParticipantSchema,
    timestamp: RecallTimestampSchema,
    data: z.union([MetadataSchema, z.null()]),
  })
  .passthrough();

const RecallParticipantChatMessageDataSchema = z
  .object({
    participant: RecallParticipantSchema,
    timestamp: RecallTimestampSchema,
    data: z
      .object({
        text: z.string(),
        to: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

const RecallParticipantEventEnvelopeSchema = createParticipantEventSchema(
  RecallParticipantEventDataSchema,
);

const RecallParticipantChatMessageEnvelopeSchema = createParticipantEventSchema(
  RecallParticipantChatMessageDataSchema,
);

const RecallTranscriptWordSchema = z
  .object({
    text: z.string(),
    start_timestamp: z
      .object({
        relative: z.number(),
      })
      .passthrough(),
    end_timestamp: z
      .object({
        relative: z.number(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();

const RecallTranscriptDataSchema = z
  .object({
    words: z.array(RecallTranscriptWordSchema),
    participant: RecallParticipantSchema,
  })
  .passthrough();

const RecallTranscriptEnvelopeSchema = createTranscriptEventSchema(
  RecallTranscriptDataSchema,
);

const RecallTranscriptProviderDataEnvelopeSchema = createTranscriptEventSchema(
  z.unknown(),
);

export const RecallParticipantEventSchema =
  RecallParticipantEventEnvelopeSchema;
export const RecallParticipantChatMessageEventSchema =
  RecallParticipantChatMessageEnvelopeSchema;
export const RecallTranscriptDataEventSchema = RecallTranscriptEnvelopeSchema;
export const RecallTranscriptPartialDataEventSchema =
  RecallTranscriptEnvelopeSchema;
export const RecallTranscriptProviderDataEventSchema =
  RecallTranscriptProviderDataEnvelopeSchema;

export type RecallParticipantEvent = z.infer<
  typeof RecallParticipantEventSchema
>;
export type RecallParticipantChatMessageEvent = z.infer<
  typeof RecallParticipantChatMessageEventSchema
>;
export type RecallTranscriptDataEvent = z.infer<
  typeof RecallTranscriptDataEventSchema
>;
export type RecallTranscriptPartialDataEvent = z.infer<
  typeof RecallTranscriptPartialDataEventSchema
>;
export type RecallTranscriptProviderDataEvent = z.infer<
  typeof RecallTranscriptProviderDataEventSchema
>;

export type RecallParticipantEventsJoinEvent = RecallParticipantEvent;
export type RecallParticipantEventsLeaveEvent = RecallParticipantEvent;
export type RecallParticipantEventsUpdateEvent = RecallParticipantEvent;
export type RecallParticipantEventsSpeechOnEvent = RecallParticipantEvent;
export type RecallParticipantEventsSpeechOffEvent = RecallParticipantEvent;
export type RecallParticipantEventsWebcamOnEvent = RecallParticipantEvent;
export type RecallParticipantEventsWebcamOffEvent = RecallParticipantEvent;
export type RecallParticipantEventsScreenshareOnEvent = RecallParticipantEvent;
export type RecallParticipantEventsScreenshareOffEvent = RecallParticipantEvent;
export type RecallParticipantEventsChatMessageEvent =
  RecallParticipantChatMessageEvent;

export type RecallTranscriptDataPayloadEvent = RecallTranscriptDataEvent;
export type RecallTranscriptPartialDataPayloadEvent =
  RecallTranscriptPartialDataEvent;
