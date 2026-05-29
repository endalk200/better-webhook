import { createHmac, timingSafeEqual } from "node:crypto";
import type {
	ProviderDefinition,
	RawHeaderValue,
	WebhookDelivery,
	WebhookEvent,
} from "@better-webhook/core";
import { getHeaderValues } from "@better-webhook/core";

export type GitHubPayload = Record<string, unknown>;

export type GitHubUser = {
	id?: number;
	login?: string;
	type?: string;
	[key: string]: unknown;
};

export type GitHubRepository = {
	id: number;
	full_name?: string;
	name?: string;
	[key: string]: unknown;
};

export type GitHubInstallation = {
	id: number;
	[key: string]: unknown;
};

export type GitHubPullRequest = {
	id?: number;
	number?: number;
	title?: string;
	state?: string;
	user?: GitHubUser;
	[key: string]: unknown;
};

export type GitHubIssueComment = {
	id?: number;
	body?: string;
	user?: GitHubUser;
	[key: string]: unknown;
};

export type GitHubCheckRun = {
	id?: number;
	name?: string;
	status?: string;
	conclusion?: string | null;
	[key: string]: unknown;
};

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
	ping: GitHubPayload & { zen?: string; hook_id?: number };
	installation: GitHubPayload & {
		action?: string;
		installation?: GitHubInstallation;
	};
	installation_repositories: GitHubPayload & {
		action?: string;
		installation?: GitHubInstallation;
	};
	pull_request: GitHubPayload & {
		action?: string;
		number?: number;
		pull_request?: GitHubPullRequest;
		repository?: GitHubRepository;
		installation?: GitHubInstallation;
	};
	issue_comment: GitHubPayload & {
		action?: string;
		comment?: GitHubIssueComment;
		issue?: Record<string, unknown>;
		repository?: GitHubRepository;
		installation?: GitHubInstallation;
	};
	pull_request_review: GitHubPayload;
	pull_request_review_comment: GitHubPayload;
	pull_request_review_thread: GitHubPayload;
	check_run: GitHubPayload & {
		action?: string;
		check_run?: GitHubCheckRun;
		repository?: GitHubRepository;
		installation?: GitHubInstallation;
	};
	check_suite: GitHubPayload;
	status: GitHubPayload;
	workflow_run: GitHubPayload;
	workflow_job: GitHubPayload;
	merge_group: GitHubPayload;
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
	GitHubPayload,
	GitHubEventEnvelope<string, GitHubPayload>
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
	const leftBuffer = Buffer.from(left, "hex");
	const rightBuffer = Buffer.from(right, "hex");
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
