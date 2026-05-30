import { createHmac, timingSafeEqual } from "node:crypto";
import type {
	ProviderDefinition,
	RawHeaderValue,
	WebhookDelivery,
	WebhookEvent,
} from "@better-webhook/core";
import type { webhooks as GitHubWebhookDefinitions } from "@octokit/openapi-webhooks-types";

export type GitHubPayload = object;

type GitHubWebhookPayload<TName extends keyof GitHubWebhookDefinitions> =
	GitHubWebhookDefinitions[TName]["post"]["requestBody"]["content"]["application/json"];

export type GitHubUser = GitHubEventPayloads["ping"]["sender"];

export type GitHubRepository = GitHubEventPayloads["pull_request"]["repository"];

export type GitHubInstallation = NonNullable<GitHubEventPayloads["installation"]["installation"]>;

export type GitHubPullRequest = GitHubEventPayloads["pull_request"]["pull_request"];

export type GitHubIssueComment = GitHubEventPayloads["issue_comment"]["comment"];

export type GitHubCheckRun = GitHubEventPayloads["check_run"]["check_run"];

export type GitHubEventEnvelope<
	TType extends string = string,
	TPayload extends GitHubPayload = GitHubPayload,
> = {
	id: string;
	type: TType;
	action?: string;
	hookId?: string;
	userAgent?: string;
	installationId?: number;
	repositoryId?: number;
	payload: TPayload;
	headers: {
		delivery: string;
		event: string;
		signature256?: string;
		hookId?: string;
		userAgent?: string;
		targetId?: string;
		targetType?: string;
	};
};

export type GitHubEventPayloads = {
	ping: GitHubWebhookPayload<"ping">;
	installation:
		| GitHubWebhookPayload<"installation-created">
		| GitHubWebhookPayload<"installation-deleted">
		| GitHubWebhookPayload<"installation-new-permissions-accepted">
		| GitHubWebhookPayload<"installation-suspend">
		| GitHubWebhookPayload<"installation-unsuspend">;
	installation_repositories:
		| GitHubWebhookPayload<"installation-repositories-added">
		| GitHubWebhookPayload<"installation-repositories-removed">;
	pull_request:
		| GitHubWebhookPayload<"pull-request-assigned">
		| GitHubWebhookPayload<"pull-request-auto-merge-disabled">
		| GitHubWebhookPayload<"pull-request-auto-merge-enabled">
		| GitHubWebhookPayload<"pull-request-closed">
		| GitHubWebhookPayload<"pull-request-converted-to-draft">
		| GitHubWebhookPayload<"pull-request-demilestoned">
		| GitHubWebhookPayload<"pull-request-dequeued">
		| GitHubWebhookPayload<"pull-request-edited">
		| GitHubWebhookPayload<"pull-request-enqueued">
		| GitHubWebhookPayload<"pull-request-labeled">
		| GitHubWebhookPayload<"pull-request-locked">
		| GitHubWebhookPayload<"pull-request-milestoned">
		| GitHubWebhookPayload<"pull-request-opened">
		| GitHubWebhookPayload<"pull-request-ready-for-review">
		| GitHubWebhookPayload<"pull-request-reopened">
		| GitHubWebhookPayload<"pull-request-review-request-removed">
		| GitHubWebhookPayload<"pull-request-review-requested">
		| GitHubWebhookPayload<"pull-request-synchronize">
		| GitHubWebhookPayload<"pull-request-unassigned">
		| GitHubWebhookPayload<"pull-request-unlabeled">
		| GitHubWebhookPayload<"pull-request-unlocked">;
	issue_comment:
		| GitHubWebhookPayload<"issue-comment-created">
		| GitHubWebhookPayload<"issue-comment-deleted">
		| GitHubWebhookPayload<"issue-comment-edited">;
	pull_request_review:
		| GitHubWebhookPayload<"pull-request-review-dismissed">
		| GitHubWebhookPayload<"pull-request-review-edited">
		| GitHubWebhookPayload<"pull-request-review-submitted">;
	pull_request_review_comment:
		| GitHubWebhookPayload<"pull-request-review-comment-created">
		| GitHubWebhookPayload<"pull-request-review-comment-deleted">
		| GitHubWebhookPayload<"pull-request-review-comment-edited">;
	pull_request_review_thread:
		| GitHubWebhookPayload<"pull-request-review-thread-resolved">
		| GitHubWebhookPayload<"pull-request-review-thread-unresolved">;
	check_run:
		| GitHubWebhookPayload<"check-run-completed">
		| GitHubWebhookPayload<"check-run-created">
		| GitHubWebhookPayload<"check-run-requested-action">
		| GitHubWebhookPayload<"check-run-rerequested">;
	check_suite:
		| GitHubWebhookPayload<"check-suite-completed">
		| GitHubWebhookPayload<"check-suite-requested">
		| GitHubWebhookPayload<"check-suite-rerequested">;
	status: GitHubWebhookPayload<"status">;
	workflow_run:
		| GitHubWebhookPayload<"workflow-run-completed">
		| GitHubWebhookPayload<"workflow-run-in-progress">
		| GitHubWebhookPayload<"workflow-run-requested">;
	workflow_job:
		| GitHubWebhookPayload<"workflow-job-completed">
		| GitHubWebhookPayload<"workflow-job-in-progress">
		| GitHubWebhookPayload<"workflow-job-queued">
		| GitHubWebhookPayload<"workflow-job-waiting">;
	merge_group:
		| GitHubWebhookPayload<"merge-group-checks-requested">
		| GitHubWebhookPayload<"merge-group-destroyed">;
};

export type KnownGitHubEventType = keyof GitHubEventPayloads;

function defineKnownGitHubEventTypes<const TTypes extends readonly KnownGitHubEventType[]>(
	types: Exclude<KnownGitHubEventType, TTypes[number]> extends never ? TTypes : never,
): TTypes {
	return types;
}

export type KnownGitHubEvent = {
	[TType in KnownGitHubEventType]: WebhookEvent<
		TType,
		GitHubEventPayloads[TType],
		GitHubEventEnvelope<TType, GitHubEventPayloads[TType]>
	> & {
		known: true;
	};
}[KnownGitHubEventType];

export type UnknownGitHubEvent = WebhookEvent<
	string,
	Record<string, unknown>,
	GitHubEventEnvelope<string, Record<string, unknown>>
> & {
	known: false;
};

export type GitHubWebhookEvent = KnownGitHubEvent | UnknownGitHubEvent;

export type GitHubProviderOptions = {
	webhookSecret: string;
};

export function github(options: GitHubProviderOptions): ProviderDefinition<GitHubWebhookEvent> {
	if (typeof options.webhookSecret !== "string" || options.webhookSecret.length === 0) {
		throw new Error("GitHub Provider Secret is required");
	}

	return {
		name: "github",
		capabilities: {
			signedTimestamp: false,
			replayKey: true,
		},
		verify(delivery) {
			const contentType = getFirstHeader(delivery.headers, "content-type");
			if (!isJsonContentType(contentType)) {
				return { ok: false, reason: "unsupported_github_content_type" };
			}

			const signature = getGitHubSignatureHeader(delivery.headers);
			if (!signature) {
				return { ok: false, reason: "missing_github_signature" };
			}

			const parsed = parseGitHubSignatureHeader(signature);
			if (!parsed) {
				return { ok: false, reason: "malformed_github_signature_header" };
			}

			const expected = computeGitHubSignature(options.webhookSecret, delivery.rawBody);
			if (!secureEqualHex(parsed, expected)) {
				return { ok: false, reason: "invalid_github_signature" };
			}

			return {
				ok: true,
				replayKey: getFirstHeader(delivery.headers, "x-github-delivery"),
				signatureId: parsed,
			};
		},
		extractEvent(delivery) {
			const envelope = parseGitHubEnvelope(delivery);
			return {
				id: envelope.id,
				type: envelope.type,
				payload: envelope.payload,
				envelope,
				known: isKnownGitHubEventType(envelope.type),
			} as GitHubWebhookEvent;
		},
	};
}

export function computeGitHubSignature(secret: string, rawBody: Uint8Array | string): string {
	const body = typeof rawBody === "string" ? new TextEncoder().encode(rawBody) : rawBody;
	return createHmac("sha256", secret).update(body).digest("hex");
}

export function createGitHubSignatureHeader(options: {
	secret: string;
	rawBody: Uint8Array | string;
}): string {
	return `sha256=${computeGitHubSignature(options.secret, options.rawBody)}`;
}

export function parseGitHubSignatureHeader(header: string): string | undefined {
	if (!header.startsWith("sha256=")) {
		return undefined;
	}
	const digest = header.slice("sha256=".length);
	return /^[a-f0-9]{64}$/i.test(digest) ? digest : undefined;
}

export function createGitHubReplayKey(delivery: WebhookDelivery): string {
	const deliveryId = getFirstHeader(delivery.headers, "x-github-delivery");
	if (!deliveryId) {
		throw new Error("GitHub delivery id is required");
	}
	return deliveryId;
}

export function parseGitHubEnvelope(
	delivery: WebhookDelivery,
): GitHubEventEnvelope<string, GitHubPayload> {
	const headers = readGitHubHeaders(delivery.headers);
	if (!headers.delivery) {
		throw new Error("GitHub Delivery ID is required");
	}
	if (!headers.event) {
		throw new Error("GitHub event name is required");
	}
	const envelopeHeaders = {
		...headers,
		delivery: headers.delivery,
		event: headers.event,
	};

	const decoded = new TextDecoder().decode(delivery.rawBody);
	const parsed: unknown = JSON.parse(decoded);
	if (!isRecord(parsed)) {
		throw new Error("GitHub payload must be an object");
	}

	const action = parsed.action;
	if (action !== undefined && typeof action !== "string") {
		throw new Error("GitHub Event Action must be a string");
	}

	const installationId = readNestedNumber(parsed, "installation", "id");
	const repositoryId = readNestedNumber(parsed, "repository", "id");

	return {
		id: headers.delivery,
		type: headers.event,
		...(action ? { action } : {}),
		...(headers.hookId ? { hookId: headers.hookId } : {}),
		...(headers.userAgent ? { userAgent: headers.userAgent } : {}),
		...(installationId !== undefined ? { installationId } : {}),
		...(repositoryId !== undefined ? { repositoryId } : {}),
		payload: parsed,
		headers: envelopeHeaders,
	};
}

export function readGitHubHeaders(headers: RawHeaderValue[]) {
	return {
		delivery: getFirstHeader(headers, "x-github-delivery"),
		event: getFirstHeader(headers, "x-github-event"),
		signature256: getFirstHeader(headers, "x-hub-signature-256"),
		hookId: getFirstHeader(headers, "x-github-hook-id"),
		userAgent: getFirstHeader(headers, "user-agent"),
		targetId: getFirstHeader(headers, "x-github-hook-installation-target-id"),
		targetType: getFirstHeader(headers, "x-github-hook-installation-target-type"),
	};
}

export function isKnownGitHubEventType(type: string): type is KnownGitHubEventType {
	return knownGitHubEventTypes.includes(type as KnownGitHubEventType);
}

export const knownGitHubEventTypes = defineKnownGitHubEventTypes([
	"ping",
	"installation",
	"installation_repositories",
	"pull_request",
	"issue_comment",
	"pull_request_review",
	"pull_request_review_comment",
	"pull_request_review_thread",
	"check_run",
	"check_suite",
	"status",
	"workflow_run",
	"workflow_job",
	"merge_group",
] as const);

function getGitHubSignatureHeader(headers: RawHeaderValue[]): string {
	return getHeaderValues(headers, "x-hub-signature-256").join(",");
}

function getFirstHeader(headers: RawHeaderValue[], name: string): string | undefined {
	return getHeaderValues(headers, name)[0];
}

function getHeaderValues(headers: RawHeaderValue[], name: string): string[] {
	const lowerName = name.toLowerCase();
	return headers
		.filter((header) => header.name.toLowerCase() === lowerName)
		.map((header) => header.value);
}

function isJsonContentType(contentType: string | undefined): boolean {
	return contentType?.split(";")[0]?.trim().toLowerCase() === "application/json";
}

function readNestedNumber(
	source: Record<string, unknown>,
	objectKey: string,
	valueKey: string,
): number | undefined {
	const object = source[objectKey];
	if (object === undefined) {
		return undefined;
	}
	if (!isRecord(object)) {
		throw new Error(`GitHub ${objectKey} must be an object`);
	}
	const value = object[valueKey];
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new Error(`GitHub ${objectKey}.${valueKey} must be a number`);
	}
	return value;
}

function secureEqualHex(left: string, right: string): boolean {
	if (left.length !== right.length || left.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(left)) {
		return false;
	}
	const leftBuffer = Buffer.from(left, "hex");
	const rightBuffer = Buffer.from(right, "hex");
	return timingSafeEqual(leftBuffer, rightBuffer);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
