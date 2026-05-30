import type {
	DeliveryTelemetry,
	TelemetryDeliveryEnd,
	TelemetryDeliveryStart,
} from "@better-webhook/core";

export type OtelSpan = {
	setAttribute(name: string, value: string | number | boolean): void;
	addEvent?(name: string, attributes?: Record<string, string | number | boolean>): void;
	recordException?(error: Error): void;
	end(): void;
};

export type OtelTracer = {
	startSpan(
		name: string,
		options?: { attributes?: Record<string, string | number | boolean> },
	): OtelSpan;
};

export type OtelOptions = {
	tracer: OtelTracer;
};

export function otel(options: OtelOptions): DeliveryTelemetry {
	return {
		startDelivery(delivery: TelemetryDeliveryStart) {
			return options.tracer.startSpan("better_webhook.delivery", {
				attributes: {
					"webhook.provider": delivery.provider,
					"http.request.method": delivery.method,
					"url.full": delivery.url,
				},
			});
		},
		finishDelivery(delivery: TelemetryDeliveryEnd, context) {
			if (!isSpan(context)) {
				return;
			}
			const span = context;
			setOptional(span, "webhook.event.type", delivery.eventType);
			setOptional(span, "webhook.event.id", delivery.eventId);
			span.setAttribute("webhook.result", delivery.status);
			span.setAttribute("webhook.verification", delivery.verification);
			span.setAttribute("webhook.replay", delivery.replay);
			span.setAttribute("webhook.idempotency", delivery.idempotency);
			span.setAttribute("webhook.handler", delivery.handler);
			span.setAttribute("http.response.status_code", delivery.responseStatus);
			span.setAttribute("webhook.duplicate", delivery.status === "duplicate");
			span.setAttribute("webhook.ignored", delivery.status === "ignored");
			span.setAttribute("webhook.rejected", delivery.status === "rejected");
			if (delivery.reason) {
				span.setAttribute("webhook.reason", delivery.reason);
			}
			if (delivery.error instanceof Error) {
				span.recordException?.(delivery.error);
			}
			span.end();
		},
		recordError(error, context) {
			if (!isSpan(context)) {
				return;
			}
			const span = context;
			span.addEvent?.("better_webhook.error", {
				"webhook.provider": error.provider,
				"exception.type": error.name,
				"exception.message": error.message,
			});
		},
	};
}

function isSpan(value: unknown): value is OtelSpan {
	return typeof value === "object" && value !== null && "setAttribute" in value && "end" in value;
}

function setOptional(span: OtelSpan, name: string, value: string | undefined): void {
	if (value !== undefined) {
		span.setAttribute(name, value);
	}
}
