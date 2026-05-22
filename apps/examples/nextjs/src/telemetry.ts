import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";

import { config } from "./config.js";

let started = false;
let sdk: NodeSDK | undefined;

export function startTelemetry(): void {
	if (started) {
		return;
	}

	sdk = new NodeSDK({
		resource: resourceFromAttributes({
			"service.name": config.otelServiceName,
		}),
		traceExporter: new OTLPTraceExporter({
			url: `${config.otelEndpoint.replace(/\/$/, "")}/v1/traces`,
		}),
	});

	sdk.start();
	started = true;
	console.log(
		`[example:nextjs] exporting Delivery Observability to ${config.otelEndpoint} as ${config.otelServiceName}`,
	);
}

export async function shutdownTelemetry(): Promise<void> {
	await sdk?.shutdown();
}
