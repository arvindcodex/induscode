import {
	captureAuthRefreshSoftFailure,
	getProviderAuthHandler,
	OAuthReauthRequiredError,
	ProviderSettingsManager,
	RuntimeOAuthTokenManager,
} from "@induscode/core";
import type { BasicLogger, ITelemetryService } from "@induscode/shared";
import { getIndusCodeEnvironmentConfig } from "@induscode/shared";

/**
 * Shared IndusCode-account auth for the sidecar: one refresh-aware OAuth manager
 * for every caller (account requests, integrations, the connectors proxy).
 * The singleton coalesces local callers; RuntimeOAuthTokenManager also locks
 * refresh/read/save across processes sharing the provider settings file.
 */
let induscodeOAuthTokenManager: RuntimeOAuthTokenManager | undefined;

export type IndusCodeAuthTelemetryContext = {
	logger?: BasicLogger;
	telemetry?: ITelemetryService;
};

/**
 * IndusCode access tokens expire between app launches, so callers must resolve
 * through the refresh-aware manager instead of reading the persisted token
 * directly; the persisted token is only the fallback when a refresh fails.
 */
export async function resolveFreshIndusCodeAuthToken(
	manager: ProviderSettingsManager,
	ctx: IndusCodeAuthTelemetryContext = {},
): Promise<string | undefined> {
	let refreshError: Error | undefined;
	try {
		induscodeOAuthTokenManager ??= new RuntimeOAuthTokenManager();
		const resolution = await induscodeOAuthTokenManager.resolveProviderApiKey({
			providerId: "induscode",
		});
		if (resolution?.apiKey) {
			return resolution.apiKey;
		}
	} catch (error) {
		// Fall back to the persisted token; when one exists the account request
		// surfaces the auth failure to the caller.
		refreshError = error instanceof Error ? error : new Error(String(error));
	}
	const persisted = getProviderAuthHandler("induscode")?.getApiKey(
		manager.getProviderSettings("induscode"),
	);
	// Never-signed-in resolves to undefined without a refresh attempt and is
	// silent. A refresh failure with no persisted fallback means credentials
	// existed but yielded nothing — that is the signal a real auth regression
	// would show up as, so report exactly one event for it.
	if (!persisted && refreshError) {
		ctx.logger?.error?.("IndusCode auth token refresh failed with no fallback", {
			error: refreshError,
		});
		captureAuthRefreshSoftFailure(ctx.telemetry, "induscode", {
			errorName: refreshError.name,
			errorCode: "desktop_refresh_failed_no_fallback_token",
		});
	}
	// A rejected refresh token means the persisted access token is dead too.
	// Handing it out would turn the signed-out state into an opaque request
	// failure (an error card whose Retry fails the same way) instead of the
	// sign-in prompt. Transient refresh failures still fall back to it.
	if (refreshError instanceof OAuthReauthRequiredError) {
		return undefined;
	}
	return persisted;
}

/**
 * The signed-in IndusCode account id, or undefined when signed out. Synchronous
 * (persisted provider settings), so identity checks can run inside the
 * no-await state-mutation windows the connector lifecycle relies on.
 */
export function getIndusCodeAccountId(): string | undefined {
	const accountId = new ProviderSettingsManager()
		.getProviderSettings("induscode")
		?.auth?.accountId?.trim();
	return accountId || undefined;
}

/** Base URL of the IndusCode API (https://api.induscode.bot in production), honoring
 * a per-provider baseUrl override and the environment config. */
export function getIndusCodeApiBaseUrl(): string {
	const override = new ProviderSettingsManager()
		.getProviderSettings("induscode")
		?.baseUrl?.trim();
	return (override || getIndusCodeEnvironmentConfig().apiBaseUrl).replace(
		/\/+$/,
		"",
	);
}

export type ConnectorsApiAuth = {
	accountId: string;
	baseUrl: string;
	token: string;
};

/**
 * Auth for the IndusCode API connectors proxy: the account bearer token plus the
 * API base URL. Undefined when signed out (or when a refresh fails with no
 * persisted fallback) — connector calls then fail closed.
 */
export async function resolveConnectorsApiAuth(
	ctx: IndusCodeAuthTelemetryContext = {},
): Promise<ConnectorsApiAuth | undefined> {
	const accountId = getIndusCodeAccountId();
	if (!accountId) return undefined;
	const token = await resolveFreshIndusCodeAuthToken(
		new ProviderSettingsManager(),
		ctx,
	);
	if (!token || getIndusCodeAccountId() !== accountId) {
		return undefined;
	}
	return { accountId, baseUrl: getIndusCodeApiBaseUrl(), token };
}
