import { z } from "zod";
import { RecallResourceSchema, RecallStatusDataSchema } from "./base.js";

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

export type RecallBotEvent = z.infer<typeof RecallBotEventSchema>;
export type RecallRecordingEvent = z.infer<typeof RecallRecordingEventSchema>;
export type RecallTranscriptArtifactEvent = z.infer<
  typeof RecallTranscriptArtifactEventSchema
>;
export type RecallParticipantEventsArtifactEvent = z.infer<
  typeof RecallParticipantEventsArtifactEventSchema
>;

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

export type RecallRecordingProcessingEvent = RecallRecordingEvent;
export type RecallRecordingDoneEvent = RecallRecordingEvent;
export type RecallRecordingFailedEvent = RecallRecordingEvent;
export type RecallRecordingDeletedEvent = RecallRecordingEvent;

export type RecallTranscriptProcessingEvent = RecallTranscriptArtifactEvent;
export type RecallTranscriptDoneEvent = RecallTranscriptArtifactEvent;
export type RecallTranscriptFailedEvent = RecallTranscriptArtifactEvent;
export type RecallTranscriptDeletedEvent = RecallTranscriptArtifactEvent;

export type RecallParticipantEventsProcessingEvent =
  RecallParticipantEventsArtifactEvent;
export type RecallParticipantEventsDoneEvent =
  RecallParticipantEventsArtifactEvent;
export type RecallParticipantEventsFailedEvent =
  RecallParticipantEventsArtifactEvent;
export type RecallParticipantEventsDeletedEvent =
  RecallParticipantEventsArtifactEvent;
