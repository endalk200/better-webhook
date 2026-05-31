import {
	createMemoryIdempotencyStore,
	createMemoryReplayStore,
	createWebhookEndpoint,
} from "@better-webhook/core";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
	createGitHubSignatureHeader,
	parseGitHubEnvelope,
	parseGitHubSignatureHeader,
} from "../src/github.js";
import {
	type GitHubEventPayloads,
	type GitHubWebhookEvent,
	github,
	type KnownGitHubEventType,
	knownGitHubEventTypes,
	type UnknownGitHubEvent,
} from "../src/index.js";

const secret = "github_webhook_secret";

function body(overrides: Record<string, unknown> = {}) {
	return JSON.stringify({
		action: "opened",
		installation: { id: 42 },
		number: 123,
		pull_request: { id: 1, number: 123, title: "Add provider" },
		repository: { id: 99, full_name: "better/webhook" },
		...overrides,
	});
}

function request(
	options: {
		rawBody?: string;
		event?: string;
		deliveryId?: string;
		signature?: string;
		contentType?: string;
	} = {},
) {
	const rawBody = options.rawBody ?? body();
	return {
		method: "POST",
		url: "https://example.test/github",
		headers: [
			{
				name: "content-type",
				value: options.contentType ?? "application/json",
			},
			{ name: "x-github-delivery", value: options.deliveryId ?? "delivery-1" },
			{ name: "x-github-event", value: options.event ?? "pull_request" },
			{
				name: "x-hub-signature-256",
				value: options.signature ?? createGitHubSignatureHeader({ secret, rawBody }),
			},
			{ name: "x-github-hook-id", value: "1234" },
			{ name: "user-agent", value: "GitHub-Hookshot/test" },
		],
		body: rawBody,
	};
}

describe("github provider", () => {
	it("requires a configured webhook secret", () => {
		expect(() => github({ webhookSecret: "" })).toThrow("GitHub Provider Secret is required");
		expect(() =>
			github({
				webhookSecret: undefined as unknown as string,
			}),
		).toThrow("GitHub Provider Secret is required");
	});

	it("verifies GitHub HMAC-SHA256 over exact raw bytes", async () => {
		const handler = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			handlers: { pull_request: handler },
		});

		const { response, result } = await endpoint.handleWithResult(request());

		expect(response.status).toBe(200);
		expect(result.status).toBe("handled");
		expect(result.replay).toBe("not_configured");
		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				event: expect.objectContaining({
					id: "delivery-1",
					type: "pull_request",
					known: true,
					envelope: expect.objectContaining({
						action: "opened",
						installationId: 42,
						repositoryId: 99,
					}),
				}),
			}),
		);
	});

	it("rejects missing, malformed, mismatched, and mutated signatures", async () => {
		const provider = github({ webhookSecret: secret });
		const valid = request();
		const delivery = {
			method: valid.method,
			url: valid.url,
			headers: valid.headers,
			rawBody: new TextEncoder().encode(body()),
		};

		expect(await provider.verify(delivery)).toMatchObject({ ok: true });
		expect(
			await provider.verify({
				...delivery,
				headers: delivery.headers.filter((header) => header.name !== "x-hub-signature-256"),
			}),
		).toMatchObject({ ok: false, reason: "missing_github_signature" });
		expect(
			await provider.verify({
				...delivery,
				headers: delivery.headers.map((header) =>
					header.name === "x-hub-signature-256" ? { ...header, value: "sha1=bad" } : header,
				),
			}),
		).toMatchObject({
			ok: false,
			reason: "malformed_github_signature_header",
		});
		expect(parseGitHubSignatureHeader("sha256=abc")).toBeUndefined();
		expect(parseGitHubSignatureHeader(`sha256=${"g".repeat(64)}`)).toBeUndefined();
		expect(
			await provider.verify({
				...delivery,
				headers: request({
					signature: createGitHubSignatureHeader({
						secret: "wrong",
						rawBody: body(),
					}),
				}).headers,
			}),
		).toMatchObject({ ok: false, reason: "invalid_github_signature" });
		expect(
			await provider.verify({
				...delivery,
				rawBody: new TextEncoder().encode(`${body()}\n`),
			}),
		).toMatchObject({ ok: false, reason: "invalid_github_signature" });
	});

	it("accepts JSON and rejects form-encoded deliveries", async () => {
		const provider = github({ webhookSecret: secret });
		expect(
			await provider.verify({
				method: "POST",
				url: "https://example.test/github",
				headers: request({ contentType: "application/json; charset=utf-8" }).headers,
				rawBody: new TextEncoder().encode(body()),
			}),
		).toMatchObject({ ok: true });
		expect(
			await provider.verify({
				method: "POST",
				url: "https://example.test/github",
				headers: request({
					contentType: "application/x-www-form-urlencoded",
				}).headers,
				rawBody: new TextEncoder().encode(body()),
			}),
		).toMatchObject({
			ok: false,
			reason: "unsupported_github_content_type",
		});
	});

	it("validates the event envelope only", async () => {
		const endpoint = createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			handlers: { pull_request: vi.fn() },
		});

		expect((await endpoint.handleWithResult(request({ deliveryId: "" }))).result).toMatchObject({
			status: "unsupported",
			reason: "invalid_event_envelope",
		});
		expect((await endpoint.handleWithResult(request({ event: "" }))).result).toMatchObject({
			status: "unsupported",
			reason: "invalid_event_envelope",
		});
		expect(
			(
				await endpoint.handleWithResult(
					request({
						rawBody: "[1]",
						signature: createGitHubSignatureHeader({
							secret,
							rawBody: "[1]",
						}),
					}),
				)
			).result,
		).toMatchObject({
			status: "unsupported",
			reason: "invalid_event_envelope",
		});
		const invalidAction = body({ action: 1 });
		expect(
			(
				await endpoint.handleWithResult(
					request({
						rawBody: invalidAction,
						signature: createGitHubSignatureHeader({
							secret,
							rawBody: invalidAction,
						}),
					}),
				)
			).result,
		).toMatchObject({
			status: "unsupported",
			reason: "invalid_event_envelope",
		});
		const invalidRepository = body({ repository: { id: "99" } });
		expect(
			(
				await endpoint.handleWithResult(
					request({
						rawBody: invalidRepository,
						signature: createGitHubSignatureHeader({
							secret,
							rawBody: invalidRepository,
						}),
					}),
				)
			).result,
		).toMatchObject({
			status: "unsupported",
			reason: "invalid_event_envelope",
		});
	});

	it("classifies known events without inspecting action values", async () => {
		expectTypeOf<(typeof knownGitHubEventTypes)[number]>().toEqualTypeOf<KnownGitHubEventType>();

		const handler = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			handlers: Object.fromEntries(knownGitHubEventTypes.map((type) => [type, handler])),
		});

		for (const event of knownGitHubEventTypes) {
			const rawBody = body({ action: "new_action_from_github" });
			const result = await endpoint.handleWithResult(
				request({
					event,
					rawBody,
					signature: createGitHubSignatureHeader({ secret, rawBody }),
				}),
			);
			expect(result.result.status).toBe("handled");
		}
	});

	it("keeps unknown events catch-all handleable", async () => {
		const catchAll = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			handlers: { "*": catchAll },
			catchAllHandlerScope: "unknown",
		});

		const result = await endpoint.handleWithResult(request({ event: "repository_ruleset" }));

		expect(result.response.status).toBe(200);
		expect(catchAll.mock.calls[0]?.[0].event.known).toBe(false);
	});

	it("dispatches named unknown GitHub event handlers", async () => {
		const unknownSpecific = vi.fn();
		const catchAll = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			unknownHandlers: {
				repository_ruleset: ({ event }) => {
					expectTypeOf(event.known).toEqualTypeOf<false>();
					expectTypeOf(event.payload).toEqualTypeOf<Record<string, unknown>>();
					unknownSpecific(event.type);
				},
			},
			handlers: { "*": catchAll },
		});

		const result = await endpoint.handleWithResult(request({ event: "repository_ruleset" }));

		expect(result.response.status).toBe(200);
		expect(unknownSpecific).toHaveBeenCalledWith("repository_ruleset");
		expect(catchAll).not.toHaveBeenCalled();
	});

	it("keeps parsed GitHub payloads indexable", () => {
		const rawBody = body();
		const delivery = request({ rawBody });
		const envelope = parseGitHubEnvelope({
			...delivery,
			rawBody: new TextEncoder().encode(rawBody),
		});
		const key = "action" as string;

		expectTypeOf(envelope.payload[key]).toEqualTypeOf<unknown>();
	});

	it("uses GitHub Delivery ID for idempotency and replay keys", async () => {
		const handler = vi.fn();
		const endpoint = createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			endpointIdentity: "github-main",
			handlers: { pull_request: handler },
			idempotencyStore: createMemoryIdempotencyStore(),
		});

		expect((await endpoint.handleWithResult(request())).result.status).toBe("handled");
		expect((await endpoint.handleWithResult(request())).result.status).toBe("duplicate");
		expect(handler).toHaveBeenCalledOnce();

		const replayEndpoint = createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			endpointIdentity: "github-main",
			handlers: { pull_request: vi.fn() },
			replayStore: createMemoryReplayStore(),
		});

		expect((await replayEndpoint.handleWithResult(request())).result.status).toBe("handled");
		expect((await replayEndpoint.handleWithResult(request())).result).toMatchObject({
			status: "rejected",
			reason: "replayed_delivery",
		});
	});

	it("releases idempotency reservations when handlers fail", async () => {
		const handler = vi.fn(() => {
			throw new Error("boom");
		});
		const endpoint = createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			endpointIdentity: "github-main",
			handlers: { pull_request: handler },
			idempotencyStore: createMemoryIdempotencyStore(),
		});

		expect((await endpoint.handleWithResult(request())).result).toMatchObject({
			status: "handler_error",
			idempotency: "released",
		});
		expect((await endpoint.handleWithResult(request())).result.status).toBe("handler_error");
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it("narrows known handlers and exposes unknown fallback types", () => {
		createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			handlers: {
				pull_request: ({ event }) => {
					expectTypeOf(event.payload.pull_request.title).toEqualTypeOf<string>();
				},
				"*": ({ event }) => {
					expectTypeOf(event).toEqualTypeOf<GitHubWebhookEvent>();
				},
			},
		});

		expectTypeOf<Extract<GitHubWebhookEvent, UnknownGitHubEvent>["payload"]>().toEqualTypeOf<
			Record<string, unknown>
		>();
	});

	it("uses generated GitHub webhook payload types for known events", () => {
		createWebhookEndpoint({
			provider: github({ webhookSecret: secret }),
			handlers: {
				ping: ({ event }) => {
					expectTypeOf(event.payload.hook_id).toEqualTypeOf<number>();
					expectTypeOf(event.payload.zen).toEqualTypeOf<string>();
				},
				installation: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.installation.id).toEqualTypeOf<number>();
				},
				installation_repositories: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.repositories_added).toEqualTypeOf<
						GitHubEventPayloads["installation_repositories"]["repositories_added"]
					>();
				},
				issue_comment: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.comment.body).toEqualTypeOf<string>();
				},
				pull_request_review: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.review.id).toEqualTypeOf<number>();
				},
				pull_request_review_comment: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.comment.path).toEqualTypeOf<string>();
				},
				pull_request_review_thread: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.thread.id).toEqualTypeOf<number>();
				},
				check_run: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.check_run.name).toEqualTypeOf<string>();
				},
				check_suite: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.check_suite.id).toEqualTypeOf<number>();
				},
				status: ({ event }) => {
					expectTypeOf(event.payload.state).toEqualTypeOf<
						"error" | "failure" | "pending" | "success"
					>();
					expectTypeOf(event.payload.sha).toEqualTypeOf<string>();
				},
				workflow_run: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.workflow_run.id).toEqualTypeOf<number>();
				},
				workflow_job: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.workflow_job.status).toEqualTypeOf<
						"completed" | "in_progress" | "queued" | "waiting"
					>();
				},
				merge_group: ({ event }) => {
					expectTypeOf(event.payload.action).toEqualTypeOf<string>();
					expectTypeOf(event.payload.merge_group.head_sha).toEqualTypeOf<string>();
				},
			},
		});
	});
});
