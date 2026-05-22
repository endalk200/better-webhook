import {
	createMemoryIdempotencyStore,
	createMemoryReplayStore,
	createWebhookEndpoint,
} from "@better-webhook/core";
import {
	type GitHubCheckRun,
	type GitHubIssueComment,
	type GitHubPullRequest,
	type GitHubWebhookEvent,
	github,
} from "@better-webhook/github";
import { toNextResponse, toRawDeliveryRequest } from "@better-webhook/nextjs";
import { otel } from "@better-webhook/otel";
import { trace } from "@opentelemetry/api";

import { githubConfig } from "../../../../src/providers/github/config.js";
import { startTelemetry } from "../../../../src/telemetry.js";

export const runtime = "nodejs";

const githubEndpoint = createWebhookEndpoint<GitHubWebhookEvent>({
	catchAllHandlerScope: "unknown",
	endpointIdentity: githubConfig.endpointIdentity,
	handlers: {
		check_run: ({ event }) => {
			const checkRun = event.payload.check_run as GitHubCheckRun | undefined;
			console.log(
				`[example:nextjs:github] handled check_run action=${event.envelope.action ?? "none"} delivery=${event.id} check=${checkRun?.name ?? "unknown"} conclusion=${checkRun?.conclusion ?? "unknown"}`,
			);
		},
		issue_comment: ({ event }) => {
			const comment = event.payload.comment as GitHubIssueComment | undefined;
			console.log(
				`[example:nextjs:github] handled issue_comment action=${event.envelope.action ?? "none"} delivery=${event.id} comment=${comment?.id ?? "unknown"}`,
			);
		},
		pull_request: ({ event }) => {
			const pullRequest = event.payload.pull_request as GitHubPullRequest | undefined;
			if (event.envelope.action === "closed") {
				console.log(
					`[example:nextjs:github] failing pull_request action=closed delivery=${event.id} so GitHub can retry`,
				);
				throw new Error("Intentional Next.js GitHub example handler failure");
			}
			console.log(
				`[example:nextjs:github] handled pull_request action=${event.envelope.action ?? "none"} delivery=${event.id} pr=${pullRequest?.number ?? "unknown"}`,
			);
		},
		"*": ({ event }) => {
			console.log(
				`[example:nextjs:github] catch-all handled unknown verified delivery=${event.id} type=${event.type}`,
			);
		},
	},
	idempotencyStore: createMemoryIdempotencyStore(),
	idempotencyTtlMs: githubConfig.idempotencyTtlMs,
	provider: github({ webhookSecret: githubConfig.webhookSecret }),
	replayStore: createMemoryReplayStore(),
	replayWindowMs: githubConfig.replayWindowMs,
	telemetry: otel({
		tracer: trace.getTracer("better-webhook-example-nextjs-github"),
	}),
});

export async function POST(request: Request): Promise<Response> {
	startTelemetry();

	const { response, result } = await githubEndpoint.handleWithResult(toRawDeliveryRequest(request));

	console.log(
		`[example:nextjs:github] delivery result status=${result.status} event=${result.eventType ?? "unknown"} id=${result.eventId ?? "none"} response=${response.status}`,
	);

	return toNextResponse(response);
}
