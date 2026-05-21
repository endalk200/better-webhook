import express from "express";
import {
  sendExpressResponse,
  toRawDeliveryRequest,
  type ExpressWebhookRequest,
} from "@better-webhook/express";

import { config } from "./config.js";
import { endpoint } from "./endpoint.js";
import { shutdownTelemetry, startTelemetry } from "./telemetry.js";

await startTelemetry();

const app = express();

app.post(
  config.webhookPath,
  express.raw({ type: "application/json" }),
  async (request, response, next) => {
    try {
      const expressRequest = request as ExpressWebhookRequest;
      expressRequest.rawBody = request.body;
      const { result, response: webhookResponse } =
        await endpoint.handleWithResult(toRawDeliveryRequest(expressRequest));

      console.log(
        `[example:express] delivery result status=${result.status} event=${result.eventType ?? "unknown"} id=${result.eventId ?? "none"} response=${webhookResponse.status}`,
      );
      sendExpressResponse(response, webhookResponse);
    } catch (error) {
      next(error);
    }
  },
);

app.use(express.json());

const server = app.listen(config.port, "127.0.0.1", () => {
  console.log(
    `[example:express] listening on http://127.0.0.1:${config.port}${config.webhookPath}`,
  );
});

const shutdown = async () => {
  server.close();
  await shutdownTelemetry();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
