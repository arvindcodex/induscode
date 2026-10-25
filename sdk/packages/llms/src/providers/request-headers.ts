import { decodeJwtPayload } from "@induscode/shared";

export interface ProviderRequestHeaderClientContext {
	name?: string;
	version?: string;
	versionHeaderFallback?: string;
	platform?: string;
	platformVersion?: string;
	isMultiRoot?: boolean;
}

export interface ProviderRequestHeaderLayers {
	stored?: Record<string, string>;
	config?: Record<string, string>;
	session?: Record<string, string>;
}

export interface OpenAICodexRequestHeaderContext {
	accountId?: string;
	accessToken?: string;
	userAgentVersion?: string;
}

export interface ResolveProviderRequestHeadersInput {
	providerId: string;
	/**
	 * Session (task) id the request belongs to, surfaced as `X-Task-ID` for
	 * IndusCode billing providers and `session_id` for OpenAI Codex.
	 *
	 * Optional because not every request is part of a session: standalone
	 * one-shot utility calls (e.g. VS Code commit message generation) have no
	 * task. When omitted, `X-Task-ID` is left off entirely rather than sent
	 * empty — the pre-SDK extension sent `X-Task-ID: ""` from that same
	 * commit-message path, so no IndusCode surface depends on a meaningful id here.
	 */
	sessionId?: string;
	source?: string;
	defaultSource: string;
	client?: ProviderRequestHeaderClientContext;
	coreVersion: string;
	openAiCodex?: OpenAICodexRequestHeaderContext;
	headers?: ProviderRequestHeaderLayers;
}

export const DEFAULT_INDUSCODE_REQUEST_HEADERS: Record<string, string> = {
	"HTTP-Referer": "https://induscode.bot",
	"X-Title": "IndusCode",
	"X-IS-MULTIROOT": "false",
	"X-CLIENT-TYPE": "induscode-sdk",
};

function isIndusCodeBillingProvider(providerId: string): boolean {
	return providerId === "induscode" || providerId === "induscode-pass";
}

function trimNonEmpty(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveSource(
	source: string | undefined,
	defaultSource: string,
): string {
	return trimNonEmpty(source) ?? defaultSource;
}

function resolveIndusCodeClientVersion(
	client: ProviderRequestHeaderClientContext | undefined,
): string {
	return (
		trimNonEmpty(client?.version) ??
		trimNonEmpty(client?.versionHeaderFallback) ??
		"unknown"
	);
}

function buildIndusCodeRequestHeaders(
	input: ResolveProviderRequestHeadersInput,
): Record<string, string> | undefined {
	if (!isIndusCodeBillingProvider(input.providerId)) {
		return undefined;
	}
	const source = resolveSource(input.source, input.defaultSource);
	const clientType = trimNonEmpty(input.client?.name) ?? `induscode-${source}`;
	const clientVersion = resolveIndusCodeClientVersion(input.client);
	const platform = trimNonEmpty(input.client?.platform) ?? source;
	const platformVersion =
		trimNonEmpty(input.client?.platformVersion) ?? clientVersion;
	const sessionId = trimNonEmpty(input.sessionId);
	return {
		...DEFAULT_INDUSCODE_REQUEST_HEADERS,
		"User-Agent": `IndusCode/${clientVersion}`,
		"X-IS-MULTIROOT": input.client?.isMultiRoot === true ? "true" : "false",
		"X-CLIENT-TYPE": clientType,
		"X-CLIENT-VERSION": clientVersion,
		"X-PLATFORM": platform,
		"X-PLATFORM-VERSION": platformVersion,
		"X-CORE-VERSION": input.coreVersion,
		...(sessionId ? { "X-Task-ID": sessionId } : {}),
	};
}

function deriveOpenAICodexAccountId(
	accessToken: string | undefined,
): string | undefined {
	const payload = decodeJwtPayload(accessToken) as
		| {
				"https://api.openai.com/auth"?: { chatgpt_account_id?: string };
				organizations?: Array<{ id?: string }>;
				chatgpt_account_id?: string;
		  }
		| undefined;
	const authAccountId =
		payload?.["https://api.openai.com/auth"]?.chatgpt_account_id;
	if (typeof authAccountId === "string" && authAccountId.length > 0) {
		return authAccountId;
	}
	const orgAccountId = payload?.organizations?.[0]?.id;
	if (typeof orgAccountId === "string" && orgAccountId.length > 0) {
		return orgAccountId;
	}
	const rootAccountId = payload?.chatgpt_account_id;
	if (typeof rootAccountId === "string" && rootAccountId.length > 0) {
		return rootAccountId;
	}
	return undefined;
}

function buildOpenAICodexRequestHeaders(
	input: ResolveProviderRequestHeadersInput,
): Record<string, string> | undefined {
	if (input.providerId !== "openai-codex") {
		return undefined;
	}
	const accountId =
		trimNonEmpty(input.openAiCodex?.accountId) ??
		deriveOpenAICodexAccountId(input.openAiCodex?.accessToken);
	const sessionId = trimNonEmpty(input.sessionId);
	return {
		originator: "induscode",
		...(sessionId ? { session_id: sessionId } : {}),
		"User-Agent": `IndusCode/${trimNonEmpty(input.openAiCodex?.userAgentVersion) ?? "1.0.0"}`,
		...(accountId ? { "ChatGPT-Account-Id": accountId } : {}),
	};
}

function resolveRequiredProviderHeaders(
	input: ResolveProviderRequestHeadersInput,
): Record<string, string> | undefined {
	if (input.providerId === "opencode-go") {
		const sessionId = trimNonEmpty(input.sessionId);
		return {
			...(sessionId ? { "x-opencode-session": sessionId } : {}),
			"User-Agent": `IndusCode/${trimNonEmpty(input.client?.version) ?? input.coreVersion}`,
		};
	}
	return (
		buildIndusCodeRequestHeaders(input) ?? buildOpenAICodexRequestHeaders(input)
	);
}

function resolveDefaultProviderHeaders(
	headers: ProviderRequestHeaderLayers | undefined,
): Record<string, string> | undefined {
	return headers?.session ?? headers?.config ?? headers?.stored;
}

export function resolveProviderRequestHeaders(
	input: ResolveProviderRequestHeadersInput,
): Record<string, string> | undefined {
	const requiredHeaders = resolveRequiredProviderHeaders(input);
	if (requiredHeaders) {
		return {
			...(input.headers?.stored ?? {}),
			...(input.headers?.config ?? {}),
			...(input.headers?.session ?? {}),
			...requiredHeaders,
		};
	}
	const headers = resolveDefaultProviderHeaders(input.headers);
	return headers ? { ...headers } : undefined;
}
