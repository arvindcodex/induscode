import {
	type IndusCodeAccountBalance,
	type IndusCodeAccountOrganization,
	type IndusCodeAccountOrganizationBalance,
	IndusCodeAccountService,
	type IndusCodeAccountUser,
	type IndusCodeSubscriptionPlan,
	formatProviderOAuthApiKey,
	getPersistedProviderApiKey,
	getProviderOAuthCredentialsFromSettings,
	getValidIndusCodeCredentials,
	type ProviderSettings,
	ProviderSettingsManager,
	persistIndusCodeAccountTelemetryIdentity,
	resolveIndusCodeAccountTelemetryIdentity,
	saveLocalProviderOAuthCredentials,
	type UserCurrentPlan,
} from "@induscode/core";
import { getIndusCodeEnvironmentConfig } from "@induscode/shared";
import { formatCreditBalance, normalizeCreditBalance } from "../utils/output";
import { identifyTelemetryAccount } from "../utils/telemetry";
import type { Config } from "../utils/types";

export const INDUSCODE_CREDITS_DASHBOARD_URL =
	"https://app.induscode.bot/dashboard/account?tab=credits";

type IndusCodeAccountConfig = Pick<Config, "apiKey" | "logger" | "providerId">;

const INDUSCODE_PASS_PROVIDER_ID = "induscode-pass";

export interface IndusCodeAccountSnapshot {
	user: IndusCodeAccountUser;
	balance: IndusCodeAccountBalance;
	organizationBalance: IndusCodeAccountOrganizationBalance | null;
	organizations: IndusCodeAccountOrganization[];
	activeOrganization: IndusCodeAccountOrganization | null;
	displayedBalance: number;
}

export function formatIndusCodeCredits(value: number): string {
	return formatCreditBalance(normalizeCreditBalance(value));
}

// FIXME: These message checks are temporary until structured error types are
// passed through to the CLI instead of plain error strings.
export function isIndusCodeAccountAuthErrorMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	return (
		normalized === "no induscode account auth token found" ||
		normalized.includes("requires re-authentication")
	);
}

export function isIndusCodeAccountCreditsErrorMessage(message: string): boolean {
	const normalized = message.trim().toLowerCase();
	// The IndusCode API's 402 response carries `code: "insufficient_credits"` and
	// the message "Not enough credits available". Depending on how much of the
	// payload survives error extraction, the CLI may see the raw JSON blob or
	// just the human-readable message, so match both. The
	// "insufficient balance" pair is an older backend phrasing kept for safety.
	return (
		normalized.includes("insufficient_credits") ||
		normalized.includes("not enough credits") ||
		(normalized.includes("insufficient balance") &&
			normalized.includes("induscode credits balance"))
	);
}

function resolveAccountApiBaseUrl(input: {
	induscodeApiBaseUrl?: string;
	induscodeProviderSettings?: ProviderSettings;
}): string {
	const settingsBaseUrl = input.induscodeProviderSettings?.baseUrl?.trim();
	if (settingsBaseUrl) {
		return settingsBaseUrl;
	}
	const configuredBaseUrl = input.induscodeApiBaseUrl?.trim();
	if (configuredBaseUrl) {
		return configuredBaseUrl;
	}
	return getIndusCodeEnvironmentConfig().apiBaseUrl;
}

function resolveIndusCodeAccountAuthToken(input: {
	config: IndusCodeAccountConfig;
	induscodeProviderSettings?: ProviderSettings;
}): string | undefined {
	const configApiKey =
		input.config.providerId === "induscode" ? input.config.apiKey.trim() : "";
	return (
		getPersistedProviderApiKey("induscode", input.induscodeProviderSettings) ||
		configApiKey ||
		undefined
	);
}

async function resolveValidIndusCodeAccountAuthToken(input: {
	config: IndusCodeAccountConfig;
	induscodeProviderSettings?: ProviderSettings;
	manager: ProviderSettingsManager;
	apiBaseUrl: string;
}): Promise<string | undefined> {
	const settings = input.induscodeProviderSettings;
	const credentials = settings
		? getProviderOAuthCredentialsFromSettings("induscode", settings)
		: null;
	if (settings && credentials) {
		const nextCredentials = await getValidIndusCodeCredentials(credentials, {
			apiBaseUrl: input.apiBaseUrl,
		});
		if (!nextCredentials) {
			throw new Error(
				"IndusCode account requires re-authentication. Run induscode auth induscode.",
			);
		}
		const nextAccessToken = formatProviderOAuthApiKey("induscode", nextCredentials);
		if (nextCredentials !== credentials) {
			saveLocalProviderOAuthCredentials(
				input.manager,
				"induscode",
				settings,
				nextCredentials,
				{ setLastUsed: false },
			);
		}
		return nextAccessToken;
	}
	return resolveIndusCodeAccountAuthToken({
		config: input.config,
		induscodeProviderSettings: settings,
	});
}

export async function createIndusCodeAccountService(input: {
	config: IndusCodeAccountConfig;
	induscodeApiBaseUrl?: string;
	induscodeProviderSettings?: ProviderSettings;
	providerSettingsManager?: ProviderSettingsManager;
}): Promise<IndusCodeAccountService | undefined> {
	const manager =
		input.providerSettingsManager ?? new ProviderSettingsManager();
	const settings =
		manager.getProviderSettings("induscode") ?? input.induscodeProviderSettings;
	const apiBaseUrl = resolveAccountApiBaseUrl({
		induscodeApiBaseUrl: input.induscodeApiBaseUrl,
		induscodeProviderSettings: settings,
	});
	const authToken = await resolveValidIndusCodeAccountAuthToken({
		config: input.config,
		induscodeProviderSettings: settings,
		manager,
		apiBaseUrl,
	});
	if (!authToken) {
		return undefined;
	}
	return new IndusCodeAccountService({
		apiBaseUrl,
		getAuthToken: async () => authToken,
	});
}

export async function loadIndusCodeAccountSnapshot(input: {
	config: IndusCodeAccountConfig;
	induscodeApiBaseUrl?: string;
	induscodeProviderSettings?: ProviderSettings;
}): Promise<IndusCodeAccountSnapshot> {
	const service = await createIndusCodeAccountService(input);
	if (!service) {
		throw new Error("No IndusCode account auth token found");
	}

	const user = await service.fetchMe();
	const organizations = user.organizations ?? [];
	const activeOrganization =
		organizations.find((organization) => organization.active) ?? null;
	const [balance, organizationBalance] = await Promise.all([
		service.fetchBalance(user.id),
		activeOrganization
			? service.fetchOrganizationBalance(activeOrganization.organizationId)
			: Promise.resolve(null),
	]);
	const displayedBalance = activeOrganization
		? (organizationBalance?.balance ?? balance.balance)
		: balance.balance;
	const accountContext = resolveIndusCodeAccountTelemetryIdentity(user);
	identifyTelemetryAccount(accountContext, input.config.logger);
	persistIndusCodeAccountTelemetryIdentity(
		new ProviderSettingsManager(),
		accountContext,
	);

	return {
		user,
		balance,
		organizationBalance,
		organizations,
		activeOrganization,
		displayedBalance,
	};
}

export async function switchIndusCodeAccount(input: {
	config: IndusCodeAccountConfig;
	organizationId?: string | null;
	induscodeApiBaseUrl?: string;
	induscodeProviderSettings?: ProviderSettings;
}): Promise<void> {
	const service = await createIndusCodeAccountService(input);
	if (!service) {
		throw new Error("No IndusCode account auth token found");
	}
	await service.switchAccount(input.organizationId);
}

export async function loadIndividualSubscriptionPlans(input: {
	config: IndusCodeAccountConfig;
	induscodeApiBaseUrl?: string;
	induscodeProviderSettings?: ProviderSettings;
}): Promise<IndusCodeSubscriptionPlan[]> {
	const service = await createIndusCodeAccountService(input);
	if (!service) {
		throw new Error("No IndusCode account auth token found");
	}
	return service.fetchAvailableSubscriptionPlans({ type: "individual" });
}

export async function loadCurrentUserPlan(input: {
	config: IndusCodeAccountConfig;
	induscodeApiBaseUrl?: string;
	induscodeProviderSettings?: ProviderSettings;
}): Promise<UserCurrentPlan | undefined> {
	const service = await createIndusCodeAccountService(input);
	if (!service) {
		throw new Error("No IndusCode account auth token found");
	}
	return service.fetchCurrentUserPlan();
}

export async function loadCurrentUserPlanFromProviderSettings(input: {
	providerSettingsManager: ProviderSettingsManager;
	induscodeApiBaseUrl?: string;
}): Promise<UserCurrentPlan | undefined> {
	const service = await createIndusCodeAccountService({
		config: { apiKey: "", logger: undefined, providerId: "induscode" },
		induscodeApiBaseUrl: input.induscodeApiBaseUrl,
		providerSettingsManager: input.providerSettingsManager,
	});
	if (!service) {
		throw new Error("No IndusCode account auth token found");
	}
	return service.fetchCurrentUserPlan();
}

export async function loadIndividualSubscriptionPlansFromProviderSettings(input: {
	providerSettingsManager: ProviderSettingsManager;
	induscodeApiBaseUrl?: string;
}): Promise<IndusCodeSubscriptionPlan[]> {
	const service = await createIndusCodeAccountService({
		config: { apiKey: "", logger: undefined, providerId: "induscode" },
		induscodeApiBaseUrl: input.induscodeApiBaseUrl,
		providerSettingsManager: input.providerSettingsManager,
	});
	if (!service) {
		throw new Error("No IndusCode account auth token found");
	}
	return service.fetchAvailableSubscriptionPlans({ type: "individual" });
}

async function onChangeToIndusCodePass(config: IndusCodeAccountConfig) {
	try {
		await switchIndusCodeAccount({
			config: config,
			organizationId: null,
		});
	} catch (error) {
		config.logger?.debug("Failed to switch IndusCodePass to personal account", {
			error,
		});
	}
}

export async function onProviderChange(input: {
	config: IndusCodeAccountConfig;
	providerId: string;
}): Promise<void> {
	if (input.providerId === INDUSCODE_PASS_PROVIDER_ID) {
		return onChangeToIndusCodePass(input.config);
	}

	return;
}
