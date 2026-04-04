import { z } from "zod";
import { RecallResourceSchema, RecallStatusDataSchema } from "./base.js";

export const RecallSdkUploadEventSchema = z
  .object({
    data: RecallStatusDataSchema,
    recording: RecallResourceSchema,
    sdk_upload: RecallResourceSchema,
  })
  .passthrough();

export type RecallSdkUploadEvent = z.infer<typeof RecallSdkUploadEventSchema>;

export type RecallSdkUploadRecordingStartedEvent = RecallSdkUploadEvent;
export type RecallSdkUploadRecordingEndedEvent = RecallSdkUploadEvent;
export type RecallSdkUploadCompleteEvent = RecallSdkUploadEvent;
export type RecallSdkUploadFailedEvent = RecallSdkUploadEvent;
