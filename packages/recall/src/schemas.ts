import { z } from "zod";

const MetadataSchema = z.object({}).passthrough();

const RecallResourceSchema = z.object({
  id: z.string(),
  metadata: MetadataSchema.optional(),
});

const RecallTimestampSchema = z.object({
  absolute: z.string(),
  relative: z.number(),
});

const RecallParticipantSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  is_host: z.boolean(),
  platform: z.string().nullable(),
  extra_data: MetadataSchema,
  email: z.string().nullable(),
});

const RecallParticipantEventDataSchema = z.object({
  participant: RecallParticipantSchema,
  timestamp: RecallTimestampSchema,
  data: z.union([MetadataSchema, z.null()]),
});

const RecallParticipantChatMessageDataSchema = z.object({
  participant: RecallParticipantSchema,
  timestamp: RecallTimestampSchema,
  data: z.object({
    text: z.string(),
    to: z.string(),
  }),
});

const RecallParticipantEventEnvelopeSchema = z.object({
  data: RecallParticipantEventDataSchema,
  realtime_endpoint: RecallResourceSchema,
  participant_events: RecallResourceSchema,
  recording: RecallResourceSchema,
  bot: RecallResourceSchema.optional(),
});

const RecallParticipantChatMessageEnvelopeSchema = z.object({
  data: RecallParticipantChatMessageDataSchema,
  realtime_endpoint: RecallResourceSchema,
  participant_events: RecallResourceSchema,
  recording: RecallResourceSchema,
  bot: RecallResourceSchema.optional(),
});

const RecallTranscriptWordSchema = z.object({
  text: z.string(),
  start_timestamp: z.object({
    relative: z.number(),
  }),
  end_timestamp: z
    .object({
      relative: z.number(),
    })
    .nullable(),
});

const RecallTranscriptDataSchema = z.object({
  words: z.array(RecallTranscriptWordSchema),
  participant: RecallParticipantSchema,
});

const RecallTranscriptEnvelopeSchema = z.object({
  data: RecallTranscriptDataSchema,
  realtime_endpoint: RecallResourceSchema,
  transcript: RecallResourceSchema,
  recording: RecallResourceSchema,
  bot: RecallResourceSchema.optional(),
});

const RecallBotStatusDataSchema = z.object({
  code: z.string(),
  sub_code: z.string().nullable(),
  updated_at: z.string(),
});

const RecallBotEventEnvelopeSchema = z.object({
  data: RecallBotStatusDataSchema,
  bot: RecallResourceSchema,
});

export const RecallParticipantEventSchema = RecallParticipantEventEnvelopeSchema;
export const RecallParticipantChatMessageEventSchema =
  RecallParticipantChatMessageEnvelopeSchema;
export const RecallTranscriptDataEventSchema = RecallTranscriptEnvelopeSchema;
export const RecallTranscriptPartialDataEventSchema =
  RecallTranscriptEnvelopeSchema;
export const RecallBotEventSchema = RecallBotEventEnvelopeSchema;

export type RecallParticipantEvent = z.infer<typeof RecallParticipantEventSchema>;
export type RecallParticipantChatMessageEvent = z.infer<
  typeof RecallParticipantChatMessageEventSchema
>;
export type RecallTranscriptDataEvent = z.infer<
  typeof RecallTranscriptDataEventSchema
>;
export type RecallTranscriptPartialDataEvent = z.infer<
  typeof RecallTranscriptPartialDataEventSchema
>;
export type RecallBotEvent = z.infer<typeof RecallBotEventSchema>;

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

export type RecallBotJoiningCallEvent = RecallBotEvent;
export type RecallBotInWaitingRoomEvent = RecallBotEvent;
export type RecallBotInCallNotRecordingEvent = RecallBotEvent;
export type RecallBotRecordingPermissionAllowedEvent = RecallBotEvent;
export type RecallBotRecordingPermissionDeniedEvent = RecallBotEvent;
export type RecallBotInCallRecordingEvent = RecallBotEvent;
export type RecallBotCallEndedEvent = RecallBotEvent;
export type RecallBotDoneEvent = RecallBotEvent;
export type RecallBotFatalEvent = RecallBotEvent;
export type RecallBotBreakoutRoomEnteredEvent = RecallBotEvent;
export type RecallBotBreakoutRoomLeftEvent = RecallBotEvent;
export type RecallBotBreakoutRoomOpenedEvent = RecallBotEvent;
export type RecallBotBreakoutRoomClosedEvent = RecallBotEvent;
