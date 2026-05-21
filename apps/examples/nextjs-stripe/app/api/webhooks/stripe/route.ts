import { toNextResponse, toRawDeliveryRequest } from "@better-webhook/nextjs";

import { endpoint } from "../../../../src/endpoint.js";
import { startTelemetry } from "../../../../src/telemetry.js";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  startTelemetry();

  const { response, result } = await endpoint.handleWithResult(
    toRawDeliveryRequest(request),
  );

  console.log(
    `[example:nextjs] delivery result status=${result.status} event=${result.eventType ?? "unknown"} id=${result.eventId ?? "none"} response=${response.status}`,
  );

  return toNextResponse(response);
}
