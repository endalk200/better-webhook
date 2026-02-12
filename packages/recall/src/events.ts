import { defineEvent } from "@better-webhook/core";
import {
  RecallParticipantEventSchema,
  RecallParticipantChatMessageEventSchema,
  RecallTranscriptDataEventSchema,
  RecallTranscriptPartialDataEventSchema,
  RecallBotEventSchema,
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

export type {
  RecallParticipantEvent,
  RecallParticipantChatMessageEvent,
  RecallTranscriptDataEvent,
  RecallTranscriptPartialDataEvent,
  RecallBotEvent,
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
} from "./schemas.js";
