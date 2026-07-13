import express from "express";

import { config } from "./config.js";
import { shutdownTelemetry, startTelemetry } from "./telemetry.js";

startTelemetry();

const app = express();

app.use(express.json());

const server = app.listen(config.port, "127.0.0.1", () => {
	console.log(`[example:express] listening on http://127.0.0.1:${config.port}`);
});

const shutdown = async () => {
	server.close();
	await shutdownTelemetry();
	process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
