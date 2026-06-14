import { isIP } from "node:net";

import type {
	EndpointMode,
	EndpointProfile,
	ProjectConfig,
	ProviderId,
	SecretReference,
} from "./model.js";

export type ValidationResult<A> =
	| {
			readonly ok: true;
			readonly value: A;
	  }
	| {
			readonly ok: false;
			readonly issues: readonly string[];
	  };

const supportedProviders = new Set<ProviderId>(["github", "stripe"]);

export const isSupportedProvider = (provider: string): provider is ProviderId =>
	supportedProviders.has(provider as ProviderId);

export const normalizeRoute = (route: string): ValidationResult<string> => {
	const trimmed = route.trim();
	if (!trimmed.startsWith("/")) {
		return { ok: false, issues: ["route must start with /"] };
	}
	if (trimmed.includes("?") || trimmed.includes("#")) {
		return { ok: false, issues: ["route must not include query strings or fragments"] };
	}
	const normalized = trimmed === "/" ? "/" : trimmed.replace(/\/+$/u, "");
	if (normalized.length === 0) {
		return { ok: true, value: "/" };
	}
	return { ok: true, value: normalized };
};

export const validateEndpointId = (id: string): ValidationResult<string> => {
	const trimmed = id.trim();
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/u.test(trimmed)) {
		return {
			ok: false,
			issues: [
				"endpoint id must start with a letter or number and contain only letters, numbers, dots, underscores, or dashes",
			],
		};
	}
	return { ok: true, value: trimmed };
};

export const isSafeTargetUrl = (targetUrl: string): ValidationResult<URL> => {
	let parsed: URL;
	try {
		parsed = new URL(targetUrl);
	} catch {
		return { ok: false, issues: ["target URL is malformed"] };
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { ok: false, issues: ["target URL must use http or https"] };
	}

	const hostname = parsed.hostname.toLowerCase();
	if (hostname === "localhost") {
		return { ok: true, value: parsed };
	}

	if (hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
		return { ok: true, value: parsed };
	}

	const ipVersion = isIP(hostname);
	if (ipVersion === 4 && isPrivateIpv4(hostname)) {
		return { ok: true, value: parsed };
	}
	if (ipVersion === 6 && isPrivateIpv6(hostname)) {
		return { ok: true, value: parsed };
	}

	return {
		ok: false,
		issues: [
			"target URL must use localhost, a loopback address, or a private LAN address; public remote targets are blocked",
		],
	};
};

const isPrivateIpv4 = (hostname: string): boolean => {
	const parts = hostname.split(".").map((part) => Number(part));
	const [first, second] = parts;
	if (
		parts.length !== 4 ||
		parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255) ||
		first === undefined ||
		second === undefined
	) {
		return false;
	}
	return (
		first === 10 ||
		first === 127 ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		(first === 169 && second === 254)
	);
};

const isPrivateIpv6 = (hostname: string): boolean => {
	const normalized = hostname.toLowerCase();
	return (
		normalized === "::1" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		normalized.startsWith("fe80:")
	);
};

export const makeProjectConfig = (options: { readonly name: string }): ProjectConfig => ({
	schemaVersion: "1",
	name: options.name.trim(),
	endpoints: {},
});

export const makeEndpointProfile = (options: {
	readonly id: string;
	readonly mode: EndpointMode;
	readonly provider?: ProviderId;
	readonly targetUrl: string;
	readonly route: string;
	readonly secretRef?: SecretReference;
	readonly now?: Date;
}): ValidationResult<EndpointProfile> => {
	const issues: string[] = [];
	const id = validateEndpointId(options.id);
	if (!id.ok) {
		issues.push(...id.issues);
	}
	const route = normalizeRoute(options.route);
	if (!route.ok) {
		issues.push(...route.issues);
	}
	const target = isSafeTargetUrl(options.targetUrl);
	if (!target.ok) {
		issues.push(...target.issues);
	}
	if (options.mode === "provider") {
		if (!options.provider) {
			issues.push("provider-aware endpoints must include a provider");
		} else if (!isSupportedProvider(options.provider)) {
			issues.push(`unsupported provider ${JSON.stringify(options.provider)}`);
		}
		if (!options.secretRef) {
			issues.push("provider-aware endpoints must include a secret reference");
		}
	}
	if (options.mode === "generic" && options.provider) {
		issues.push("generic endpoints must not include a provider");
	}

	if (issues.length > 0 || !id.ok || !route.ok || !target.ok) {
		return { ok: false, issues };
	}

	const timestamp = (options.now ?? new Date()).toISOString();
	return {
		ok: true,
		value: {
			id: id.value,
			mode: options.mode,
			...(options.provider ? { provider: options.provider } : {}),
			targetUrl: target.value.toString(),
			route: route.value,
			...(options.secretRef ? { secretRef: options.secretRef } : {}),
			createdAt: timestamp,
			updatedAt: timestamp,
		},
	};
};

export const validateProjectConfig = (input: unknown): ValidationResult<ProjectConfig> => {
	if (!isRecord(input)) {
		return { ok: false, issues: ["project config must be an object"] };
	}

	const issues: string[] = [];
	if (input.schemaVersion !== "1") {
		issues.push("schemaVersion must be 1");
	}
	if (typeof input.name !== "string" || input.name.trim().length === 0) {
		issues.push("project name is required");
	}

	const endpointsInput = isRecord(input.endpoints) ? input.endpoints : {};
	const endpoints: Record<string, EndpointProfile> = {};
	const seenRoutes = new Set<string>();
	for (const [key, value] of Object.entries(endpointsInput)) {
		if (!isRecord(value)) {
			issues.push(`endpoint ${key} must be an object`);
			continue;
		}
		const provider = typeof value.provider === "string" ? value.provider : undefined;
		const endpoint = makeEndpointProfile({
			id: typeof value.id === "string" ? value.id : key,
			mode: value.mode === "provider" ? "provider" : "generic",
			...(provider && isSupportedProvider(provider)
				? { provider }
				: provider
					? { provider: provider as ProviderId }
					: {}),
			targetUrl: typeof value.targetUrl === "string" ? value.targetUrl : "",
			route: typeof value.route === "string" ? value.route : "",
			secretRef: parseSecretReference(value.secretRef),
			now: value.createdAt ? new Date(String(value.createdAt)) : new Date(0),
		});
		if (!endpoint.ok) {
			issues.push(...endpoint.issues.map((issue) => `endpoint ${key}: ${issue}`));
			continue;
		}
		if (key !== endpoint.value.id) {
			issues.push(`endpoint key ${key} must match endpoint id ${endpoint.value.id}`);
		}
		if (seenRoutes.has(endpoint.value.route)) {
			issues.push(`duplicate inbound route ${endpoint.value.route}`);
		}
		seenRoutes.add(endpoint.value.route);
		endpoints[endpoint.value.id] = {
			...endpoint.value,
			createdAt:
				typeof value.createdAt === "string" && value.createdAt.length > 0
					? value.createdAt
					: endpoint.value.createdAt,
			updatedAt:
				typeof value.updatedAt === "string" && value.updatedAt.length > 0
					? value.updatedAt
					: endpoint.value.updatedAt,
		};
	}

	if (issues.length > 0) {
		return { ok: false, issues };
	}

	return {
		ok: true,
		value: {
			schemaVersion: "1",
			name: String(input.name).trim(),
			endpoints,
		},
	};
};

const parseSecretReference = (value: unknown): SecretReference | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}
	if (value.kind === "env" && typeof value.name === "string" && value.name.length > 0) {
		return { kind: "env", name: value.name };
	}
	if (value.kind === "literal" && typeof value.value === "string" && value.value.length > 0) {
		return { kind: "literal", value: value.value };
	}
	return undefined;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
