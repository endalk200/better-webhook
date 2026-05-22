import {
	createMemoryIdempotencyStore,
	createMemoryReplayStore,
	createWebhookEndpoint,
} from "@better-webhook/core";
import {
	type ExpressWebhookRequest,
	sendExpressResponse,
	toRawDeliveryRequest,
} from "@better-webhook/express";
import {
	type GitHubCheckRun,
	type GitHubIssueComment,
	type GitHubPullRequest,
	type GitHubWebhookEvent,
	github,
} from "@better-webhook/github";
import { otel } from "@better-webhook/otel";
import { trace } from "@opentelemetry/api";
import express from "express";

import { githubConfig } from "../providers/github/config.js";

const githubEndpoint = createWebhookEndpoint<GitHubWebhookEvent>({
	catchAllHandlerScope: "unknown",
	endpointIdentity: githubConfig.endpointIdentity,
	handlers: {
		check_run: ({ event }) => {
			const checkRun = event.payload.check_run as GitHubCheckRun | undefined;
			console.log(
				`[example:express:github] handled check_run action=${event.envelope.action ?? "none"} delivery=${event.id} check=${checkRun?.name ?? "unknown"} conclusion=${checkRun?.conclusion ?? "unknown"}`,
			);
		},
		issue_comment: ({ event }) => {
			const comment = event.payload.comment as GitHubIssueComment | undefined;
			console.log(
				`[example:express:github] handled issue_comment action=${event.envelope.action ?? "none"} delivery=${event.id} comment=${comment?.id ?? "unknown"}`,
			);
		},
		pull_request: ({ event }) => {
			const pullRequest = event.payload.pull_request as GitHubPullRequest | undefined;
			if (event.envelope.action === "closed") {
				console.log(
					`[example:express:github] failing pull_request action=closed delivery=${event.id} so GitHub can retry`,
				);
				throw new Error("Intentional Express GitHub example handler failure");
			}
			console.log(
				`[example:express:github] handled pull_request action=${event.envelope.action ?? "none"} delivery=${event.id} pr=${pullRequest?.number ?? "unknown"}`,
			);
		},
		"*": ({ event }) => {
			console.log(
				`[example:express:github] catch-all handled unknown verified delivery=${event.id} type=${event.type}`,
			);
		},
	},
	idempotencyStore: createMemoryIdempotencyStore(),
	idempotencyTtlMs: githubConfig.idempotencyTtlMs,
	provider: github({ webhookSecret: githubConfig.webhookSecret }),
	replayStore: createMemoryReplayStore(),
	replayWindowMs: githubConfig.replayWindowMs,
	telemetry: otel({
		tracer: trace.getTracer("better-webhook-example-express-github"),
	}),
});

export const githubWebhookRouter: express.Router = express.Router();

githubWebhookRouter.post(
	githubConfig.webhookPath,
	express.raw({ type: "application/json" }),
	async (request, response, next) => {
		try {
			const expressRequest = request as ExpressWebhookRequest;
			expressRequest.rawBody = request.body;
			const { result, response: webhookResponse } = await githubEndpoint.handleWithResult(
				toRawDeliveryRequest(expressRequest),
			);

			console.log(
				`[example:express:github] delivery result status=${result.status} event=${result.eventType ?? "unknown"} id=${result.eventId ?? "none"} response=${webhookResponse.status}`,
			);
			sendExpressResponse(response, webhookResponse);
		} catch (error) {
			next(error);
		}
	},
);
