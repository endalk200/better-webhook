import { defineEvent } from "@better-webhook/core";
import {
  RecallBotEventSchema,
  RecallCalendarSyncEventsEventSchema,
  RecallCalendarUpdateEventSchema,
  RecallParticipantChatMessageEventSchema,
  RecallParticipantEventSchema,
  RecallParticipantEventsArtifactEventSchema,
  RecallRecordingEventSchema,
  RecallSdkUploadEventSchema,
  RecallTranscriptArtifactEventSchema,
  RecallTranscriptDataEventSchema,
  RecallTranscriptPartialDataEventSchema,
  RecallTranscriptProviderDataEventSchema,
} from "./schemas.js";

export type RecallProvider = "recall";

export const participant_events_join = defineEvent({
  name: "participant_events.join",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_leave = defineEvent({
  name: "participant_events.leave",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_update = defineEvent({
  name: "participant_events.update",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_speech_on = defineEvent({
  name: "participant_events.speech_on",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_speech_off = defineEvent({
  name: "participant_events.speech_off",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_webcam_on = defineEvent({
  name: "participant_events.webcam_on",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_webcam_off = defineEvent({
  name: "participant_events.webcam_off",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_screenshare_on = defineEvent({
  name: "participant_events.screenshare_on",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_screenshare_off = defineEvent({
  name: "participant_events.screenshare_off",
  schema: RecallParticipantEventSchema,
  provider: "recall" as const,
});

export const participant_events_chat_message = defineEvent({
  name: "participant_events.chat_message",
  schema: RecallParticipantChatMessageEventSchema,
  provider: "recall" as const,
});

export const participant_events_processing = defineEvent({
  name: "participant_events.processing",
  schema: RecallParticipantEventsArtifactEventSchema,
  provider: "recall" as const,
});

export const participant_events_done = defineEvent({
  name: "participant_events.done",
  schema: RecallParticipantEventsArtifactEventSchema,
  provider: "recall" as const,
});

export const participant_events_failed = defineEvent({
  name: "participant_events.failed",
  schema: RecallParticipantEventsArtifactEventSchema,
  provider: "recall" as const,
});

export const participant_events_deleted = defineEvent({
  name: "participant_events.deleted",
  schema: RecallParticipantEventsArtifactEventSchema,
  provider: "recall" as const,
});

export const transcript_data = defineEvent({
  name: "transcript.data",
  schema: RecallTranscriptDataEventSchema,
  provider: "recall" as const,
});

export const transcript_partial_data = defineEvent({
  name: "transcript.partial_data",
  schema: RecallTranscriptPartialDataEventSchema,
  provider: "recall" as const,
});

export const transcript_provider_data = defineEvent({
  name: "transcript.provider_data",
  schema: RecallTranscriptProviderDataEventSchema,
  provider: "recall" as const,
});

export const transcript_processing = defineEvent({
  name: "transcript.processing",
  schema: RecallTranscriptArtifactEventSchema,
  provider: "recall" as const,
});

export const transcript_done = defineEvent({
  name: "transcript.done",
  schema: RecallTranscriptArtifactEventSchema,
  provider: "recall" as const,
});

export const transcript_failed = defineEvent({
  name: "transcript.failed",
  schema: RecallTranscriptArtifactEventSchema,
  provider: "recall" as const,
});

export const transcript_deleted = defineEvent({
  name: "transcript.deleted",
  schema: RecallTranscriptArtifactEventSchema,
  provider: "recall" as const,
});

export const recording_processing = defineEvent({
  name: "recording.processing",
  schema: RecallRecordingEventSchema,
  provider: "recall" as const,
});

export const recording_done = defineEvent({
  name: "recording.done",
  schema: RecallRecordingEventSchema,
  provider: "recall" as const,
});

export const recording_failed = defineEvent({
  name: "recording.failed",
  schema: RecallRecordingEventSchema,
  provider: "recall" as const,
});

export const recording_deleted = defineEvent({
  name: "recording.deleted",
  schema: RecallRecordingEventSchema,
  provider: "recall" as const,
});

export const bot_joining_call = defineEvent({
  name: "bot.joining_call",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_in_waiting_room = defineEvent({
  name: "bot.in_waiting_room",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_in_call_not_recording = defineEvent({
  name: "bot.in_call_not_recording",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_recording_permission_allowed = defineEvent({
  name: "bot.recording_permission_allowed",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_recording_permission_denied = defineEvent({
  name: "bot.recording_permission_denied",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_in_call_recording = defineEvent({
  name: "bot.in_call_recording",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_call_ended = defineEvent({
  name: "bot.call_ended",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_done = defineEvent({
  name: "bot.done",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_fatal = defineEvent({
  name: "bot.fatal",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_breakout_room_entered = defineEvent({
  name: "bot.breakout_room_entered",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_breakout_room_left = defineEvent({
  name: "bot.breakout_room_left",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_breakout_room_opened = defineEvent({
  name: "bot.breakout_room_opened",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const bot_breakout_room_closed = defineEvent({
  name: "bot.breakout_room_closed",
  schema: RecallBotEventSchema,
  provider: "recall" as const,
});

export const calendar_update = defineEvent({
  name: "calendar.update",
  schema: RecallCalendarUpdateEventSchema,
  provider: "recall" as const,
});

export const calendar_sync_events = defineEvent({
  name: "calendar.sync_events",
  schema: RecallCalendarSyncEventsEventSchema,
  provider: "recall" as const,
});

export const sdk_upload_recording_started = defineEvent({
  name: "sdk_upload.recording_started",
  schema: RecallSdkUploadEventSchema,
  provider: "recall" as const,
});

export const sdk_upload_recording_ended = defineEvent({
  name: "sdk_upload.recording_ended",
  schema: RecallSdkUploadEventSchema,
  provider: "recall" as const,
});

export const sdk_upload_complete = defineEvent({
  name: "sdk_upload.complete",
  schema: RecallSdkUploadEventSchema,
  provider: "recall" as const,
});

export const sdk_upload_failed = defineEvent({
  name: "sdk_upload.failed",
  schema: RecallSdkUploadEventSchema,
  provider: "recall" as const,
});

export type {
  RecallParticipantEvent,
  RecallParticipantChatMessageEvent,
  RecallTranscriptDataEvent,
  RecallTranscriptPartialDataEvent,
  RecallTranscriptProviderDataEvent,
  RecallBotEvent,
  RecallRecordingEvent,
  RecallTranscriptArtifactEvent,
  RecallParticipantEventsArtifactEvent,
  RecallCalendarUpdateEvent,
  RecallCalendarSyncEventsEvent,
  RecallSdkUploadEvent,
  RecallParticipantEventsJoinEvent,
  RecallParticipantEventsLeaveEvent,
  RecallParticipantEventsUpdateEvent,
  RecallParticipantEventsSpeechOnEvent,
  RecallParticipantEventsSpeechOffEvent,
  RecallParticipantEventsWebcamOnEvent,
  RecallParticipantEventsWebcamOffEvent,
  RecallParticipantEventsScreenshareOnEvent,
  RecallParticipantEventsScreenshareOffEvent,
  RecallParticipantEventsChatMessageEvent,
  RecallTranscriptDataPayloadEvent,
  RecallTranscriptPartialDataPayloadEvent,
  RecallBotJoiningCallEvent,
  RecallBotInWaitingRoomEvent,
  RecallBotInCallNotRecordingEvent,
  RecallBotRecordingPermissionAllowedEvent,
  RecallBotRecordingPermissionDeniedEvent,
  RecallBotInCallRecordingEvent,
  RecallBotCallEndedEvent,
  RecallBotDoneEvent,
  RecallBotFatalEvent,
  RecallBotBreakoutRoomEnteredEvent,
  RecallBotBreakoutRoomLeftEvent,
  RecallBotBreakoutRoomOpenedEvent,
  RecallBotBreakoutRoomClosedEvent,
  RecallRecordingProcessingEvent,
  RecallRecordingDoneEvent,
  RecallRecordingFailedEvent,
  RecallRecordingDeletedEvent,
  RecallTranscriptProcessingEvent,
  RecallTranscriptDoneEvent,
  RecallTranscriptFailedEvent,
  RecallTranscriptDeletedEvent,
  RecallParticipantEventsProcessingEvent,
  RecallParticipantEventsDoneEvent,
  RecallParticipantEventsFailedEvent,
  RecallParticipantEventsDeletedEvent,
  RecallSdkUploadRecordingStartedEvent,
  RecallSdkUploadRecordingEndedEvent,
  RecallSdkUploadCompleteEvent,
  RecallSdkUploadFailedEvent,
} from "./schemas.js";
