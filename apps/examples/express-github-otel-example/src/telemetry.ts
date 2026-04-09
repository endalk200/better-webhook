import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let telemetrySdk: NodeSDK | undefined;

export async function startTelemetry(): Promise<void> {
  if (telemetrySdk) {
    return;
  }

  telemetrySdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: "better-webhook-express-github-otel-example",
    }),
    spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    metricReader: new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 5_000,
    }),
  });

  await telemetrySdk.start();
  console.log("OpenTelemetry SDK started");
}

export async function stopTelemetry(): Promise<void> {
  if (!telemetrySdk) {
    return;
  }

  await telemetrySdk.shutdown();
  telemetrySdk = undefined;
  console.log("OpenTelemetry SDK stopped");
}
