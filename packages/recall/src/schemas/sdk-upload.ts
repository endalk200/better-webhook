import { z } from "zod";
import { RecallResourceSchema, RecallStatusDataSchema } from "./base.js";

function createStatusDataSchema<Code extends string>(code: Code) {
  return RecallStatusDataSchema.extend({
    code: z.literal(code),
  });
}

function createSdkUploadEventSchema<Code extends string>(code: Code) {
  return z
    .object({
      data: createStatusDataSchema(code),
      recording: RecallResourceSchema,
      sdk_upload: RecallResourceSchema,
    })
    .passthrough();
}

const RecallSdkUploadEventEnvelopeSchema = z
  .object({
    data: RecallStatusDataSchema,
    recording: RecallResourceSchema,
    sdk_upload: RecallResourceSchema,
  })
  .passthrough();

export const RecallSdkUploadEventSchema = RecallSdkUploadEventEnvelopeSchema;

export const RecallSdkUploadRecordingStartedEventSchema =
  createSdkUploadEventSchema("recording_started");
export const RecallSdkUploadRecordingEndedEventSchema =
  createSdkUploadEventSchema("recording_ended");
export const RecallSdkUploadCompleteEventSchema =
  createSdkUploadEventSchema("complete");
export const RecallSdkUploadFailedEventSchema =
  createSdkUploadEventSchema("failed");

export type RecallSdkUploadEvent = z.infer<typeof RecallSdkUploadEventSchema>;

export type RecallSdkUploadRecordingStartedEvent = z.infer<
  typeof RecallSdkUploadRecordingStartedEventSchema
>;
export type RecallSdkUploadRecordingEndedEvent = z.infer<
  typeof RecallSdkUploadRecordingEndedEventSchema
>;
export type RecallSdkUploadCompleteEvent = z.infer<
  typeof RecallSdkUploadCompleteEventSchema
>;
export type RecallSdkUploadFailedEvent = z.infer<
  typeof RecallSdkUploadFailedEventSchema
>;
