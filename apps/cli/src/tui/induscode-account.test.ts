import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../utils/types";

const coreMocks = vi.hoisted(() => {
	const serviceOptions: Array<{
		apiBaseUrl: string;
		getAuthToken: () => Promise<string | undefined | null>;
	}> = [];
	return {
		getProviderSettings: vi.fn(),
		saveProviderSettings: vi.fn(),
		fetchMe: vi.fn(),
		fetchBalance: vi.fn(),
		fetchOrganizationBalance: vi.fn(),
		fetchAvailableSubscriptionPlans: vi.fn(),
		fetchCurrentUserPlan: vi.fn(),
		serviceOptions,
	};
});
const telemetryMocks = vi.hoisted(() => ({
	identifyTelemetryAccount: vi.fn(),
}));

vi.mock("@induscode/core", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@induscode/core")>();
	return {
		...actual,
		IndusCodeAccountService: class {
			constructor(options: {
				apiBaseUrl: string;
				getAuthToken: () => Promise<string | undefined | null>;
			}) {
				coreMocks.serviceOptions.push(options);
			}
			fetchMe() {
				return coreMocks.fetchMe();
			}
			fetchBalance(userId?: string) {
				return coreMocks.fetchBalance(userId);
			}
			fetchOrganizationBalance(organizationId: string) {
				return coreMocks.fetchOrganizationBalance(organizationId);
			}
			fetchAvailableSubscriptionPlans(input?: {
				type?: "individual" | "teams";
			}) {
				return coreMocks.fetchAvailableSubscriptionPlans(input);
			}
			fetchCurrentUserPlan() {
				return coreMocks.fetchCurrentUserPlan();
			}
		},
		ProviderSettingsManager: class {
			getProviderSettings(providerId: string) {
				return coreMocks.getProviderSettings(providerId);
			}
			saveProviderSettings(settings: unknown, options?: unknown) {
				coreMocks.saveProviderSettings(settings, options);
			}
		},
	};
});

vi.mock("../utils/telemetry", () => ({
	identifyTelemetryAccount: telemetryMocks.identifyTelemetryAccount,
}));

function makeConfig(overrides: Partial<Config> = {}): Config {
	return {
		providerId: "induscode",
		modelId: "anthropic/claude-sonnet-4.6",
		apiKey: "",
		verbose: false,
		sandbox: false,
		thinking: false,
		outputMode: "text",
		mode: "act",
		defaultToolAutoApprove: false,
		toolPolicies: {},
		enableTools: true,
		cwd: "/tmp/workspace",
		logger: {
			debug: vi.fn(),
			log: vi.fn(),
			error: vi.fn(),
		},
		...overrides,
	} as unknown as Config;
}

function mockFetchJson(body: unknown, status = 200): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			async () =>
				new Response(JSON.stringify(body), {
					status,
					headers: { "Content-Type": "application/json" },
				}),
		) as unknown as typeof fetch,
	);
}

describe("createIndusCodeAccountService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		coreMocks.getProviderSettings.mockReset();
		coreMocks.saveProviderSettings.mockReset();
		coreMocks.fetchMe.mockReset();
		coreMocks.fetchBalance.mockReset();
		coreMocks.fetchOrganizationBalance.mockReset();
		coreMocks.fetchAvailableSubscriptionPlans.mockReset();
		coreMocks.fetchCurrentUserPlan.mockReset();
		coreMocks.serviceOptions.length = 0;
		telemetryMocks.identifyTelemetryAccount.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("refreshes persisted IndusCode OAuth credentials before creating the account service", async () => {
		vi.spyOn(Date, "now").mockReturnValue(100_000);
		mockFetchJson({
			success: true,
			data: {
				accessToken: "new-access",
				refreshToken: "new-refresh",
				tokenType: "Bearer",
				expiresAt: "2096-10-02T07:06:40.000Z",
				userInfo: {
					subject: "sub-new",
					email: "new@example.com",
					name: "New User",
					induscodeUserId: "acct-new",
					accounts: [],
				},
			},
		});
		coreMocks.getProviderSettings.mockReturnValue({
			provider: "induscode",
			auth: {
				accessToken: "workos:old-access",
				refreshToken: "refresh-token",
				accountId: "acct-old",
				expiresAt: 1,
			},
		});

		const { createIndusCodeAccountService } = await import("./induscode-account");
		const service = await createIndusCodeAccountService({ config: makeConfig() });

		expect(service).toBeDefined();
		expect(globalThis.fetch).toHaveBeenCalled();
		expect(coreMocks.saveProviderSettings).toHaveBeenCalledWith(
			expect.objectContaining({
				provider: "induscode",
				auth: expect.objectContaining({
					accessToken: "workos:new-access",
					refreshToken: "new-refresh",
					accountId: "acct-new",
					expiresAt: 4_000_000_000_000,
				}),
			}),
			{ setLastUsed: false, tokenSource: "oauth" },
		);
		expect(await coreMocks.serviceOptions[0]?.getAuthToken()).toBe(
			"workos:new-access",
		);
	});

	it("asks the user to re-authenticate when IndusCode OAuth credentials cannot refresh", async () => {
		vi.spyOn(Date, "now").mockReturnValue(100_000);
		mockFetchJson(
			{
				error: "invalid_grant",
				error_description: "refresh expired",
			},
			401,
		);
		coreMocks.getProviderSettings.mockReturnValue({
			provider: "induscode",
			auth: {
				accessToken: "workos:old-access",
				refreshToken: "refresh-token",
				expiresAt: 1,
			},
		});

		const { createIndusCodeAccountService } = await import("./induscode-account");

		await expect(
			createIndusCodeAccountService({ config: makeConfig() }),
		).rejects.toThrow(
			"IndusCode account requires re-authentication. Run induscode auth induscode.",
		);
	});
});

describe("loadIndusCodeAccountSnapshot", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		coreMocks.getProviderSettings.mockReset();
		coreMocks.saveProviderSettings.mockReset();
		coreMocks.fetchMe.mockReset();
		coreMocks.fetchBalance.mockReset();
		coreMocks.fetchOrganizationBalance.mockReset();
		coreMocks.fetchAvailableSubscriptionPlans.mockReset();
		coreMocks.fetchCurrentUserPlan.mockReset();
		coreMocks.serviceOptions.length = 0;
		telemetryMocks.identifyTelemetryAccount.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("identifies the loaded IndusCode account for telemetry and feature flags", async () => {
		coreMocks.getProviderSettings.mockReturnValue({
			provider: "induscode",
			apiKey: "account-token",
		});
		const { loadIndusCodeAccountSnapshot } = await import("./induscode-account");
		coreMocks.fetchMe.mockResolvedValue({
			id: "user-1",
			email: "user@example.com",
			displayName: "User One",
			photoUrl: "",
			createdAt: "",
			updatedAt: "",
			organizations: [
				{
					active: true,
					memberId: "member-1",
					name: "Acme",
					organizationId: "org-1",
					roles: ["member"],
				},
			],
		});
		coreMocks.fetchBalance.mockResolvedValue({ balance: 10, userId: "user-1" });
		coreMocks.fetchOrganizationBalance.mockResolvedValue({
			balance: 20,
			organizationId: "org-1",
		});

		await loadIndusCodeAccountSnapshot({ config: makeConfig() });

		expect(telemetryMocks.identifyTelemetryAccount).toHaveBeenCalledWith(
			{
				id: "user-1",
				email: "user@example.com",
				provider: "induscode",
				organizationId: "org-1",
				organizationName: "Acme",
				memberId: "member-1",
			},
			expect.any(Object),
		);
	});
});

describe("loadIndividualSubscriptionPlans", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		coreMocks.getProviderSettings.mockReset();
		coreMocks.saveProviderSettings.mockReset();
		coreMocks.fetchMe.mockReset();
		coreMocks.fetchBalance.mockReset();
		coreMocks.fetchOrganizationBalance.mockReset();
		coreMocks.fetchAvailableSubscriptionPlans.mockReset();
		coreMocks.fetchCurrentUserPlan.mockReset();
		coreMocks.serviceOptions.length = 0;
		telemetryMocks.identifyTelemetryAccount.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("loads individual subscription plans through the authorized account service", async () => {
		const plans = [
			{
				id: "plan-1",
				interval: "Monthly",
				features: { included: ["Major open-weights models"] },
			},
		];
		coreMocks.getProviderSettings.mockReturnValue({
			provider: "induscode",
			apiKey: "account-token",
		});
		coreMocks.fetchAvailableSubscriptionPlans.mockResolvedValue(plans);

		const { loadIndividualSubscriptionPlans } = await import("./induscode-account");
		const result = await loadIndividualSubscriptionPlans({
			config: makeConfig(),
		});

		expect(coreMocks.fetchAvailableSubscriptionPlans).toHaveBeenCalledWith({
			type: "individual",
		});
		expect(result).toEqual(plans);
	});
});

describe("isIndusCodeAccountCreditsErrorMessage", () => {
	it("matches the raw insufficient_credits JSON payload from the IndusCode API 402", async () => {
		const { isIndusCodeAccountCreditsErrorMessage } = await import(
			"./induscode-account"
		);
		expect(
			isIndusCodeAccountCreditsErrorMessage(
				'{"code":"insufficient_credits","current_balance":-0.14,"message":"Not enough credits available"}',
			),
		).toBe(true);
	});

	it("matches the insufficient_credits payload wrapped in an error prefix", async () => {
		const { isIndusCodeAccountCreditsErrorMessage } = await import(
			"./induscode-account"
		);
		expect(
			isIndusCodeAccountCreditsErrorMessage(
				'Error: {"code":"insufficient_credits","current_balance":0,"message":"Not enough credits available"}',
			),
		).toBe(true);
	});

	it("matches the plain human-readable IndusCode API message", async () => {
		const { isIndusCodeAccountCreditsErrorMessage } = await import(
			"./induscode-account"
		);
		expect(
			isIndusCodeAccountCreditsErrorMessage("Not enough credits available"),
		).toBe(true);
	});

	it("matches the legacy insufficient balance phrasing", async () => {
		const { isIndusCodeAccountCreditsErrorMessage } = await import(
			"./induscode-account"
		);
		expect(
			isIndusCodeAccountCreditsErrorMessage(
				"Insufficient balance. Your IndusCode credits balance is $0.00.",
			),
		).toBe(true);
	});

	it("does not match unrelated errors", async () => {
		const { isIndusCodeAccountCreditsErrorMessage } = await import(
			"./induscode-account"
		);
		expect(isIndusCodeAccountCreditsErrorMessage("Payment Required")).toBe(false);
		expect(
			isIndusCodeAccountCreditsErrorMessage(
				"Your credit balance is too low to access the Anthropic API.",
			),
		).toBe(false);
		expect(
			isIndusCodeAccountCreditsErrorMessage("insufficient balance on gateway"),
		).toBe(false);
	});
});
