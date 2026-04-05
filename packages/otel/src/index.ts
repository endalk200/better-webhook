import type {
  WebhookBodyTooLargeData,
  WebhookCompletedData,
  WebhookInstrumentation,
  WebhookInstrumentationContext,
  WebhookEventUnhandledData,
  WebhookHandlerFailedData,
  WebhookHandlerStartedData,
  WebhookHandlerSucceededData,
  WebhookJsonParseFailedData,
  WebhookReplayCommittedData,
  WebhookReplayDuplicateData,
  WebhookReplayFreshnessRejectedData,
  WebhookReplayReleasedData,
  WebhookReplayReservedData,
  WebhookReplaySkippedData,
  WebhookSchemaValidationFailedData,
  WebhookSchemaValidationSucceededData,
  WebhookVerificationFailedData,
  WebhookVerificationSucceededData,
} from "@better-webhook/core";
import {
  context as otelContext,
  metrics,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Counter,
  type Histogram,
} from "@opentelemetry/api";

const PACKAGE_NAME = "@better-webhook/otel";

export interface OpenTelemetryInstrumentationOptions {
  emitMetrics?: boolean;
  emitSpanEvents?: boolean;
  includeEventTypeAttribute?: boolean;
  includeDeliveryIdAttribute?: boolean;
  includeReplayKeyAttribute?: boolean;
}

interface MetricInstruments {
  requests: Counter;
  completed: Counter;
  duration: Histogram;
  verificationFailures: Counter;
  schemaValidationFailures: Counter;
  handlerFailures: Counter;
  replayDuplicates: Counter;
  bodyTooLarge: Counter;
}

interface RequestState {
  hasInternalError: boolean;
  verificationOutcome: string;
  replayOutcome: string;
  schemaValidationOutcome: string;
}

function buildSpanContextAttributes(
  context: WebhookInstrumentationContext,
  options: Required<OpenTelemetryInstrumentationOptions>,
): Attributes {
  const attributes: Attributes = {
    "better_webhook.provider": context.provider,
    "better_webhook.raw_body_bytes": context.rawBodyBytes,
  };

  if (options.includeEventTypeAttribute && context.eventType) {
    attributes["better_webhook.event_type"] = context.eventType;
  }

  if (options.includeDeliveryIdAttribute && context.deliveryId) {
    attributes["better_webhook.delivery_id"] = context.deliveryId;
  }

  return attributes;
}

function buildMetricAttributes(
  context: WebhookInstrumentationContext,
  options: Required<OpenTelemetryInstrumentationOptions>,
  extra?: Attributes,
): Attributes {
  const attributes: Attributes = {
    "better_webhook.provider": context.provider,
    ...extra,
  };

  if (options.includeEventTypeAttribute && context.eventType) {
    attributes["better_webhook.event_type"] = context.eventType;
  }

  return attributes;
}

function buildReplayAttributes(
  replayKey: string,
  options: Required<OpenTelemetryInstrumentationOptions>,
): Attributes {
  if (!options.includeReplayKeyAttribute) {
    return {};
  }

  return { "better_webhook.replay_key": replayKey };
}

function recordCounter(
  counter: Counter | undefined,
  attributes: Attributes,
): void {
  counter?.add(1, attributes);
}

function createMetricInstruments(): MetricInstruments {
  const meter = metrics.getMeter(PACKAGE_NAME);

  return {
    requests: meter.createCounter("better_webhook.requests", {
      description: "Total webhook requests observed",
    }),
    completed: meter.createCounter("better_webhook.completed", {
      description: "Completed webhook requests",
    }),
    duration: meter.createHistogram("better_webhook.duration", {
      description: "Webhook processing duration",
      unit: "ms",
    }),
    verificationFailures: meter.createCounter(
      "better_webhook.verification_failures",
      {
        description: "Webhook verification failures",
      },
    ),
    schemaValidationFailures: meter.createCounter(
      "better_webhook.schema_validation_failures",
      {
        description: "Webhook schema validation failures",
      },
    ),
    handlerFailures: meter.createCounter("better_webhook.handler_failures", {
      description: "Webhook handler failures",
    }),
    replayDuplicates: meter.createCounter("better_webhook.replay_duplicates", {
      description: "Duplicate webhook deliveries",
    }),
    bodyTooLarge: meter.createCounter("better_webhook.body_too_large", {
      description: "Webhook requests rejected by body size limit",
    }),
  };
}

export function createOpenTelemetryInstrumentation(
  options: OpenTelemetryInstrumentationOptions = {},
): WebhookInstrumentation {
  const resolvedOptions: Required<OpenTelemetryInstrumentationOptions> = {
    emitMetrics: options.emitMetrics ?? true,
    emitSpanEvents: options.emitSpanEvents ?? true,
    includeEventTypeAttribute: options.includeEventTypeAttribute ?? false,
    includeDeliveryIdAttribute: options.includeDeliveryIdAttribute ?? false,
    includeReplayKeyAttribute: options.includeReplayKeyAttribute ?? false,
  };

  let instruments: MetricInstruments | undefined;

  const getInstruments = (): MetricInstruments | undefined => {
    if (!resolvedOptions.emitMetrics) {
      return undefined;
    }

    instruments ??= createMetricInstruments();
    return instruments;
  };

  return {
    onRequestStart(context: WebhookInstrumentationContext) {
      const tracer = trace.getTracer(PACKAGE_NAME);
      const requestInstruments = getInstruments();
      const span = tracer.startSpan(
        "better-webhook.process",
        {
          kind: SpanKind.INTERNAL,
          attributes: buildSpanContextAttributes(context, resolvedOptions),
        },
        otelContext.active(),
      );
      const state: RequestState = {
        hasInternalError: false,
        verificationOutcome: "unknown",
        replayOutcome: "unknown",
        schemaValidationOutcome: "unknown",
      };

      recordCounter(
        requestInstruments?.requests,
        buildMetricAttributes(context, resolvedOptions),
      );

      const activeSpanContext = trace.setSpan(otelContext.active(), span);

      const syncSpanContext = (): void => {
        span.setAttributes(
          buildSpanContextAttributes(context, resolvedOptions),
        );
      };

      const addSpanEvent = (name: string, attributes?: Attributes): void => {
        syncSpanContext();
        if (!resolvedOptions.emitSpanEvents) {
          return;
        }
        span.addEvent(name, attributes);
      };

      const recordUnexpectedFailure = (error: Error): void => {
        state.hasInternalError = true;
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
      };

      return {
        async wrapHandler(next: () => Promise<void>) {
          await otelContext.with(activeSpanContext, next);
        },
        onBodyTooLarge(data: WebhookBodyTooLargeData) {
          span.setAttribute("better_webhook.body_too_large", true);
          recordCounter(
            requestInstruments?.bodyTooLarge,
            buildMetricAttributes(context, resolvedOptions, {
              "better_webhook.outcome": "body_too_large",
            }),
          );
          addSpanEvent("body_too_large", {
            "better_webhook.max_body_bytes": data.maxBodyBytes,
          });
        },
        onJsonParseFailed(data: WebhookJsonParseFailedData) {
          addSpanEvent("json_parse_failed", {
            "better_webhook.duration_ms": data.durationMs,
            "better_webhook.error": data.error,
          });
        },
        onVerificationSucceeded(data: WebhookVerificationSucceededData) {
          state.verificationOutcome = "succeeded";
          span.setAttribute("better_webhook.verification_outcome", "succeeded");
          addSpanEvent("verification_succeeded", {
            "better_webhook.duration_ms": data.durationMs,
          });
        },
        onVerificationFailed(data: WebhookVerificationFailedData) {
          state.verificationOutcome = "failed";
          span.setAttribute("better_webhook.verification_outcome", "failed");
          recordCounter(
            requestInstruments?.verificationFailures,
            buildMetricAttributes(context, resolvedOptions, {
              "better_webhook.outcome": "verification_failed",
            }),
          );
          addSpanEvent("verification_failed", {
            "better_webhook.duration_ms": data.durationMs,
            "better_webhook.reason": data.reason,
          });
        },
        onReplaySkipped(data: WebhookReplaySkippedData) {
          state.replayOutcome = "skipped";
          span.setAttribute("better_webhook.replay_outcome", "skipped");
          addSpanEvent("replay_skipped", {
            "better_webhook.reason": data.reason,
          });
        },
        onReplayFreshnessRejected(data: WebhookReplayFreshnessRejectedData) {
          state.replayOutcome = "freshness_rejected";
          span.setAttribute(
            "better_webhook.replay_outcome",
            "freshness_rejected",
          );
          addSpanEvent("replay_freshness_rejected", {
            "better_webhook.timestamp": data.timestamp,
            "better_webhook.tolerance_seconds": data.toleranceSeconds,
          });
        },
        onReplayReserved(data: WebhookReplayReservedData) {
          state.replayOutcome = "reserved";
          span.setAttribute("better_webhook.replay_outcome", "reserved");
          addSpanEvent("replay_reserved", {
            "better_webhook.in_flight_ttl_seconds": data.inFlightTtlSeconds,
            ...buildReplayAttributes(data.replayKey, resolvedOptions),
          });
        },
        onReplayDuplicate(data: WebhookReplayDuplicateData) {
          state.replayOutcome = "duplicate";
          span.setAttribute("better_webhook.replay_outcome", "duplicate");
          recordCounter(
            requestInstruments?.replayDuplicates,
            buildMetricAttributes(context, resolvedOptions, {
              "better_webhook.outcome": "replay_duplicate",
              "better_webhook.duplicate_behavior": data.behavior,
            }),
          );
          addSpanEvent("replay_duplicate", {
            "better_webhook.duplicate_behavior": data.behavior,
            ...buildReplayAttributes(data.replayKey, resolvedOptions),
          });
        },
        onReplayCommitted(data: WebhookReplayCommittedData) {
          state.replayOutcome = "committed";
          span.setAttribute("better_webhook.replay_outcome", "committed");
          addSpanEvent("replay_committed", {
            "better_webhook.ttl_seconds": data.ttlSeconds,
            ...buildReplayAttributes(data.replayKey, resolvedOptions),
          });
        },
        onReplayReleased(data: WebhookReplayReleasedData) {
          state.replayOutcome = "released";
          span.setAttribute("better_webhook.replay_outcome", "released");
          addSpanEvent("replay_released", {
            "better_webhook.reason": data.reason,
            ...buildReplayAttributes(data.replayKey, resolvedOptions),
          });
        },
        onEventUnhandled(data: WebhookEventUnhandledData) {
          span.setAttribute("better_webhook.handled", false);
          addSpanEvent("event_unhandled", {
            "better_webhook.duration_ms": data.durationMs,
          });
        },
        onSchemaValidationSucceeded(
          data: WebhookSchemaValidationSucceededData,
        ) {
          state.schemaValidationOutcome = "succeeded";
          span.setAttribute(
            "better_webhook.schema_validation_outcome",
            "succeeded",
          );
          addSpanEvent("schema_validation_succeeded", {
            "better_webhook.duration_ms": data.durationMs,
          });
        },
        onSchemaValidationFailed(data: WebhookSchemaValidationFailedData) {
          state.schemaValidationOutcome = "failed";
          span.setAttribute(
            "better_webhook.schema_validation_outcome",
            "failed",
          );
          recordCounter(
            requestInstruments?.schemaValidationFailures,
            buildMetricAttributes(context, resolvedOptions, {
              "better_webhook.outcome": "schema_validation_failed",
            }),
          );
          addSpanEvent("schema_validation_failed", {
            "better_webhook.duration_ms": data.durationMs,
            "better_webhook.error": data.error,
          });
        },
        onHandlerStarted(data: WebhookHandlerStartedData) {
          addSpanEvent("handler_started", {
            "better_webhook.handler_index": data.handlerIndex,
            "better_webhook.handler_count": data.handlerCount,
          });
        },
        onHandlerSucceeded(data: WebhookHandlerSucceededData) {
          addSpanEvent("handler_succeeded", {
            "better_webhook.handler_index": data.handlerIndex,
            "better_webhook.handler_count": data.handlerCount,
            "better_webhook.duration_ms": data.durationMs,
          });
        },
        onHandlerFailed(data: WebhookHandlerFailedData) {
          recordUnexpectedFailure(data.error);
          recordCounter(
            requestInstruments?.handlerFailures,
            buildMetricAttributes(context, resolvedOptions, {
              "better_webhook.outcome": "handler_failed",
            }),
          );
          addSpanEvent("handler_failed", {
            "better_webhook.handler_index": data.handlerIndex,
            "better_webhook.handler_count": data.handlerCount,
            "better_webhook.duration_ms": data.durationMs,
            "better_webhook.error": data.error.message,
          });
        },
        onCompleted(data: WebhookCompletedData) {
          syncSpanContext();
          const completionAttributes = {
            "http.response.status_code": data.status,
            "better_webhook.success": data.success,
            "better_webhook.verification_outcome": state.verificationOutcome,
            "better_webhook.replay_outcome": state.replayOutcome,
            "better_webhook.schema_validation_outcome":
              state.schemaValidationOutcome,
          } satisfies Attributes;

          span.setAttributes(completionAttributes);
          if (!state.hasInternalError && data.status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }

          addSpanEvent("completed", {
            ...completionAttributes,
            "better_webhook.duration_ms": data.durationMs,
          });

          const metricAttributes = buildMetricAttributes(
            context,
            resolvedOptions,
            {
              "http.response.status_code": data.status,
              "better_webhook.success": data.success,
            },
          );
          recordCounter(requestInstruments?.completed, metricAttributes);
          requestInstruments?.duration.record(
            data.durationMs,
            metricAttributes,
          );
          span.end();
        },
      };
    },
  };
}
