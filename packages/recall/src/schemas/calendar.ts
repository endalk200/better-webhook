import { z } from "zod";

export const RecallCalendarUpdateEventSchema = z
  .object({
    calendar_id: z.string(),
  })
  .passthrough();

export const RecallCalendarSyncEventsEventSchema = z
  .object({
    calendar_id: z.string(),
    last_updated_ts: z.string(),
  })
  .passthrough();

export type RecallCalendarUpdateEvent = z.infer<
  typeof RecallCalendarUpdateEventSchema
>;
export type RecallCalendarSyncEventsEvent = z.infer<
  typeof RecallCalendarSyncEventsEventSchema
>;
