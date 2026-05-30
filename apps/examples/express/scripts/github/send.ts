import { createHmac } from "node:crypto";

import { githubConfig, githubWebhookUrl } from "../../src/providers/github/config.js";

type Scenario =
	| "pull-request"
	| "issue-comment"
	| "check-run"
	| "duplicate"
	| "replay"
	| "ignored"
	| "unknown"
	| "failure";

const scenario = process.argv[2] as Scenario | undefined;

if (!scenario) {
	console.error(
		"Usage: bun run send:github:<pull-request|issue-comment|check-run|duplicate|replay|ignored|unknown|failure>",
	);
	process.exit(1);
}

if (scenario === "duplicate") {
	const payload = pullRequestPayload("opened");
	await sendSignedDelivery("duplicate:first", "pull_request", payload, {
		deliveryId: "github-example-duplicate",
	});
	await sendSignedDelivery("duplicate:second", "pull_request", payload, {
		deliveryId: "github-example-duplicate",
	});
} else if (scenario === "replay") {
	const payload = pullRequestPayload("synchronize");
	const deliveryId = "github-example-replay";
	const rawBody = JSON.stringify(payload);
	const signature = createGitHubSignatureHeader({
		rawBody,
		secret: githubConfig.webhookSecret,
	});
	await postDelivery("replay:first", "pull_request", deliveryId, rawBody, signature);
	await postDelivery("replay:second", "pull_request", deliveryId, rawBody, signature);
} else if (scenario === "pull-request") {
	await sendSignedDelivery("pull-request", "pull_request", pullRequestPayload("opened"));
} else if (scenario === "issue-comment") {
	await sendSignedDelivery("issue-comment", "issue_comment", issueCommentPayload());
} else if (scenario === "check-run") {
	await sendSignedDelivery("check-run", "check_run", checkRunPayload());
} else if (scenario === "ignored") {
	await sendSignedDelivery("ignored", "check_suite", {
		action: "completed",
		repository: repository(),
	});
} else if (scenario === "unknown") {
	await sendSignedDelivery("unknown", "repository_ruleset", {
		action: "created",
		repository: repository(),
	});
} else if (scenario === "failure") {
	await sendSignedDelivery("failure", "pull_request", pullRequestPayload("closed"));
}

function pullRequestPayload(action: string) {
	return {
		action,
		installation: { id: 1001 },
		number: 42,
		pull_request: { id: 2002, number: 42, title: "Improve webhook handling" },
		repository: repository(),
	};
}

function issueCommentPayload() {
	return {
		action: "created",
		comment: { body: "/review", id: 3003, user: { login: "octocat" } },
		issue: { number: 42, pull_request: {} },
		installation: { id: 1001 },
		repository: repository(),
	};
}

function checkRunPayload() {
	return {
		action: "completed",
		check_run: {
			conclusion: "success",
			id: 4004,
			name: "ci",
			status: "completed",
		},
		installation: { id: 1001 },
		repository: repository(),
	};
}

function repository() {
	return { full_name: "better/webhook", id: 5005, name: "webhook" };
}

async function sendSignedDelivery(
	label: string,
	event: string,
	payload: Record<string, unknown>,
	options: { deliveryId?: string } = {},
): Promise<void> {
	const rawBody = JSON.stringify(payload);
	const signature = createGitHubSignatureHeader({
		rawBody,
		secret: githubConfig.webhookSecret,
	});
	await postDelivery(
		label,
		event,
		options.deliveryId ?? `github-example-${label}`,
		rawBody,
		signature,
	);
}

function createGitHubSignatureHeader(options: {
	rawBody: Uint8Array | string;
	secret: string;
}): string {
	const body =
		typeof options.rawBody === "string"
			? new TextEncoder().encode(options.rawBody)
			: options.rawBody;
	return `sha256=${createHmac("sha256", options.secret).update(body).digest("hex")}`;
}

async function postDelivery(
	label: string,
	event: string,
	deliveryId: string,
	rawBody: string,
	signature: string,
): Promise<void> {
	const response = await fetch(githubWebhookUrl(), {
		body: rawBody,
		headers: {
			"content-type": "application/json",
			"user-agent": "GitHub-Hookshot/local-example",
			"x-github-delivery": deliveryId,
			"x-github-event": event,
			"x-hub-signature-256": signature,
		},
		method: "POST",
	});
	console.log(
		`[sender:express:github] ${label} status=${response.status} body=${await response.text()}`,
	);
}
