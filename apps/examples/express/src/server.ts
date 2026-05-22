import express from "express";

import { config } from "./config.js";
import { githubConfig } from "./providers/github/config.js";
import { stripeConfig } from "./providers/stripe/config.js";
import { githubWebhookRouter } from "./routes/github-webhook.js";
import { stripeWebhookRouter } from "./routes/stripe-webhook.js";
import { shutdownTelemetry, startTelemetry } from "./telemetry.js";

startTelemetry();

const app = express();

app.use(githubWebhookRouter);
app.use(stripeWebhookRouter);
app.use(express.json());

const server = app.listen(config.port, "127.0.0.1", () => {
	console.log(
		`[example:express] listening on http://127.0.0.1:${config.port}${stripeConfig.webhookPath}`,
	);
	console.log(
		`[example:express] listening on http://127.0.0.1:${config.port}${githubConfig.webhookPath}`,
	);
});

const shutdown = async () => {
	server.close();
	await shutdownTelemetry();
	process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
