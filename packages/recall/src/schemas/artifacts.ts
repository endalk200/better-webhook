import { z } from "zod";
import { RecallResourceSchema, RecallStatusDataSchema } from "./base.js";

function createStatusDataSchema<Code extends string>(code: Code) {
  return RecallStatusDataSchema.extend({
    code: z.literal(code),
  });
}

function createBotEventSchema<Code extends string>(code: Code) {
  return z
    .object({
      data: createStatusDataSchema(code),
      bot: RecallResourceSchema,
    })
    .passthrough();
}

function createRecordingEventSchema<Code extends string>(code: Code) {
  return z
    .object({
      data: createStatusDataSchema(code),
      recording: RecallResourceSchema,
      bot: RecallResourceSchema.optional(),
    })
    .passthrough();
}

function createTranscriptArtifactEventSchema<Code extends string>(code: Code) {
  return z
    .object({
      data: createStatusDataSchema(code),
      transcript: RecallResourceSchema,
      recording: RecallResourceSchema,
      bot: RecallResourceSchema.optional(),
    })
    .passthrough();
}

function createParticipantEventsArtifactEventSchema<Code extends string>(
  code: Code,
) {
  return z
    .object({
      data: createStatusDataSchema(code),
      participant_events: RecallResourceSchema,
      recording: RecallResourceSchema,
      bot: RecallResourceSchema.optional(),
    })
    .passthrough();
}

const RecallBotEventEnvelopeSchema = z
  .object({
    data: RecallStatusDataSchema,
    bot: RecallResourceSchema,
  })
  .passthrough();

const RecallRecordingEventEnvelopeSchema = z
  .object({
    data: RecallStatusDataSchema,
    recording: RecallResourceSchema,
    bot: RecallResourceSchema.optional(),
  })
  .passthrough();

const RecallTranscriptArtifactEventEnvelopeSchema = z
  .object({
    data: RecallStatusDataSchema,
    transcript: RecallResourceSchema,
    recording: RecallResourceSchema,
    bot: RecallResourceSchema.optional(),
  })
  .passthrough();

const RecallParticipantEventsArtifactEventEnvelopeSchema = z
  .object({
    data: RecallStatusDataSchema,
    participant_events: RecallResourceSchema,
    recording: RecallResourceSchema,
    bot: RecallResourceSchema.optional(),
  })
  .passthrough();

export const RecallBotEventSchema = RecallBotEventEnvelopeSchema;
export const RecallRecordingEventSchema = RecallRecordingEventEnvelopeSchema;
export const RecallTranscriptArtifactEventSchema =
  RecallTranscriptArtifactEventEnvelopeSchema;
export const RecallParticipantEventsArtifactEventSchema =
  RecallParticipantEventsArtifactEventEnvelopeSchema;

export const RecallBotJoiningCallEventSchema =
  createBotEventSchema("joining_call");
export const RecallBotInWaitingRoomEventSchema =
  createBotEventSchema("in_waiting_room");
export const RecallBotInCallNotRecordingEventSchema = createBotEventSchema(
  "in_call_not_recording",
);
export const RecallBotRecordingPermissionAllowedEventSchema =
  createBotEventSchema("recording_permission_allowed");
export const RecallBotRecordingPermissionDeniedEventSchema =
  createBotEventSchema("recording_permission_denied");
export const RecallBotInCallRecordingEventSchema =
  createBotEventSchema("in_call_recording");
export const RecallBotCallEndedEventSchema = createBotEventSchema("call_ended");
export const RecallBotDoneEventSchema = createBotEventSchema("done");
export const RecallBotFatalEventSchema = createBotEventSchema("fatal");
export const RecallBotBreakoutRoomEnteredEventSchema = createBotEventSchema(
  "breakout_room_entered",
);
export const RecallBotBreakoutRoomLeftEventSchema =
  createBotEventSchema("breakout_room_left");
export const RecallBotBreakoutRoomOpenedEventSchema = createBotEventSchema(
  "breakout_room_opened",
);
export const RecallBotBreakoutRoomClosedEventSchema = createBotEventSchema(
  "breakout_room_closed",
);

export const RecallRecordingProcessingEventSchema =
  createRecordingEventSchema("processing");
export const RecallRecordingDoneEventSchema =
  createRecordingEventSchema("done");
export const RecallRecordingFailedEventSchema =
  createRecordingEventSchema("failed");
export const RecallRecordingDeletedEventSchema =
  createRecordingEventSchema("deleted");

export const RecallTranscriptProcessingEventSchema =
  createTranscriptArtifactEventSchema("processing");
export const RecallTranscriptDoneEventSchema =
  createTranscriptArtifactEventSchema("done");
export const RecallTranscriptFailedEventSchema =
  createTranscriptArtifactEventSchema("failed");
export const RecallTranscriptDeletedEventSchema =
  createTranscriptArtifactEventSchema("deleted");

export const RecallParticipantEventsProcessingEventSchema =
  createParticipantEventsArtifactEventSchema("processing");
export const RecallParticipantEventsDoneEventSchema =
  createParticipantEventsArtifactEventSchema("done");
export const RecallParticipantEventsFailedEventSchema =
  createParticipantEventsArtifactEventSchema("failed");
export const RecallParticipantEventsDeletedEventSchema =
  createParticipantEventsArtifactEventSchema("deleted");

export type RecallBotEvent = z.infer<typeof RecallBotEventSchema>;
export type RecallRecordingEvent = z.infer<typeof RecallRecordingEventSchema>;
export type RecallTranscriptArtifactEvent = z.infer<
  typeof RecallTranscriptArtifactEventSchema
>;
export type RecallParticipantEventsArtifactEvent = z.infer<
  typeof RecallParticipantEventsArtifactEventSchema
>;

export type RecallBotJoiningCallEvent = z.infer<
  typeof RecallBotJoiningCallEventSchema
>;
export type RecallBotInWaitingRoomEvent = z.infer<
  typeof RecallBotInWaitingRoomEventSchema
>;
export type RecallBotInCallNotRecordingEvent = z.infer<
  typeof RecallBotInCallNotRecordingEventSchema
>;
export type RecallBotRecordingPermissionAllowedEvent = z.infer<
  typeof RecallBotRecordingPermissionAllowedEventSchema
>;
export type RecallBotRecordingPermissionDeniedEvent = z.infer<
  typeof RecallBotRecordingPermissionDeniedEventSchema
>;
export type RecallBotInCallRecordingEvent = z.infer<
  typeof RecallBotInCallRecordingEventSchema
>;
export type RecallBotCallEndedEvent = z.infer<
  typeof RecallBotCallEndedEventSchema
>;
export type RecallBotDoneEvent = z.infer<typeof RecallBotDoneEventSchema>;
export type RecallBotFatalEvent = z.infer<typeof RecallBotFatalEventSchema>;
export type RecallBotBreakoutRoomEnteredEvent = z.infer<
  typeof RecallBotBreakoutRoomEnteredEventSchema
>;
export type RecallBotBreakoutRoomLeftEvent = z.infer<
  typeof RecallBotBreakoutRoomLeftEventSchema
>;
export type RecallBotBreakoutRoomOpenedEvent = z.infer<
  typeof RecallBotBreakoutRoomOpenedEventSchema
>;
export type RecallBotBreakoutRoomClosedEvent = z.infer<
  typeof RecallBotBreakoutRoomClosedEventSchema
>;

export type RecallRecordingProcessingEvent = z.infer<
  typeof RecallRecordingProcessingEventSchema
>;
export type RecallRecordingDoneEvent = z.infer<
  typeof RecallRecordingDoneEventSchema
>;
export type RecallRecordingFailedEvent = z.infer<
  typeof RecallRecordingFailedEventSchema
>;
export type RecallRecordingDeletedEvent = z.infer<
  typeof RecallRecordingDeletedEventSchema
>;

export type RecallTranscriptProcessingEvent = z.infer<
  typeof RecallTranscriptProcessingEventSchema
>;
export type RecallTranscriptDoneEvent = z.infer<
  typeof RecallTranscriptDoneEventSchema
>;
export type RecallTranscriptFailedEvent = z.infer<
  typeof RecallTranscriptFailedEventSchema
>;
export type RecallTranscriptDeletedEvent = z.infer<
  typeof RecallTranscriptDeletedEventSchema
>;

export type RecallParticipantEventsProcessingEvent = z.infer<
  typeof RecallParticipantEventsProcessingEventSchema
>;
export type RecallParticipantEventsDoneEvent = z.infer<
  typeof RecallParticipantEventsDoneEventSchema
>;
export type RecallParticipantEventsFailedEvent = z.infer<
  typeof RecallParticipantEventsFailedEventSchema
>;
export type RecallParticipantEventsDeletedEvent = z.infer<
  typeof RecallParticipantEventsDeletedEventSchema
>;
