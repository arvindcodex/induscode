import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	formatProviderOAuthApiKey,
	getPersistedProviderApiKey,
	getProviderAuthHandler,
	getProviderAuthStorageId,
	getProviderOAuthCredentialsFromSettings,
	isOAuthProvider,
	loginAndSaveProviderOAuthCredentials,
	resolveProviderApiKeyFromSettings,
} from "./provider-auth-registry";

const { loginIndusCodeOAuth } = vi.hoisted(() => ({
	loginIndusCodeOAuth: vi.fn(),
}));

vi.mock("./induscode", () => ({
	getValidIndusCodeCredentials: vi.fn(),
	loginIndusCodeOAuth,
}));

vi.mock("./oca", () => ({
	getValidOcaCredentials: vi.fn(),
	loginOcaOAuth: vi.fn(),
}));

vi.mock("./codex", () => ({
	getValidOpenAICodexCredentials: vi.fn(),
	loginOpenAICodex: vi.fn(),
}));

describe("provider auth registry", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns handlers for managed OAuth providers only", () => {
		expect(getProviderAuthHandler("induscode")?.providerId).toBe("induscode");
		expect(getProviderAuthHandler("induscode-pass")?.providerId).toBe("induscode-pass");
		expect(getProviderAuthHandler("oca")?.providerId).toBe("oca");
		expect(getProviderAuthHandler("openai-codex")?.providerId).toBe(
			"openai-codex",
		);
		expect(getProviderAuthHandler("openai-codex-cli")).toBeUndefined();
		expect(isOAuthProvider("openai-codex-cli")).toBe(false);
	});

	it("returns storage provider IDs from handlers", () => {
		expect(getProviderAuthStorageId("induscode")).toBe("induscode");
		expect(getProviderAuthStorageId("induscode-pass")).toBe("induscode");
		expect(getProviderAuthStorageId("oca")).toBe("oca");
		expect(getProviderAuthStorageId("openai-codex")).toBe("openai-codex");
		expect(getProviderAuthStorageId("openai-codex-cli")).toBeUndefined();
	});

	it("formats IndusCode WorkOS tokens without double-prefixing", () => {
		expect(formatProviderOAuthApiKey("induscode", { access: "abc" })).toBe(
			"workos:abc",
		);
		expect(formatProviderOAuthApiKey("induscode-pass", { access: "abc" })).toBe(
			"workos:abc",
		);
		expect(formatProviderOAuthApiKey("induscode", { access: "workos:abc" })).toBe(
			"workos:abc",
		);
		expect(
			getPersistedProviderApiKey("induscode-pass", {
				provider: "induscode",
				auth: { accessToken: "abc" },
			}),
		).toBe("workos:abc");
	});

	it("login/save for IndusCodePass stores credentials under IndusCode storage", async () => {
		loginIndusCodeOAuth.mockResolvedValueOnce({
			access: "new-access",
			refresh: "new-refresh",
			expires: 4_000_000_000_000,
			accountId: "acct-new",
			metadata: { sessionStartedAtMs: 1_700_000_000_000 },
		});
		const getProviderSettings = vi.fn().mockReturnValue({
			provider: "induscode",
			apiKey: "manual-key",
		});
		const saveProviderSettings = vi.fn();
		const manager = {
			getProviderSettings,
			saveProviderSettings,
		} as never;

		const saved = await loginAndSaveProviderOAuthCredentials(
			manager,
			"induscode-pass",
			{
				callbacks: {
					onAuth: vi.fn(),
					onPrompt: vi.fn(async () => ""),
				},
			},
		);

		expect(getProviderSettings).toHaveBeenCalledWith("induscode");
		expect(saved).toMatchObject({
			provider: "induscode",
			apiKey: "manual-key",
			auth: {
				accessToken: "workos:new-access",
				refreshToken: "new-refresh",
				accountId: "acct-new",
				expiresAt: 4_000_000_000_000,
				metadata: { sessionStartedAtMs: 1_700_000_000_000 },
			},
		});
		expect(saveProviderSettings).toHaveBeenCalledWith(
			expect.objectContaining({ provider: "induscode" }),
			{ tokenSource: "oauth" },
		);
	});

	it("IndusCodePass resolves API keys from IndusCode storage", () => {
		const getProviderSettings = vi.fn().mockReturnValue({
			provider: "induscode",
			auth: { accessToken: "abc" },
		});
		const manager = { getProviderSettings } as never;

		expect(resolveProviderApiKeyFromSettings(manager, "induscode-pass")).toBe(
			"workos:abc",
		);
		expect(getProviderSettings).toHaveBeenCalledWith("induscode");
	});

	it("login/save stores credentials under handler storageProviderId", async () => {
		loginIndusCodeOAuth.mockResolvedValueOnce({
			access: "new-access",
			refresh: "new-refresh",
			expires: 4_000_000_000_000,
			accountId: "acct-new",
			metadata: { sessionStartedAtMs: 1_700_000_000_001 },
		});
		const getProviderSettings = vi.fn().mockReturnValue({
			provider: "induscode",
			apiKey: "manual-key",
		});
		const saveProviderSettings = vi.fn();
		const manager = {
			getProviderSettings,
			saveProviderSettings,
		} as never;

		const saved = await loginAndSaveProviderOAuthCredentials(manager, "induscode", {
			callbacks: {
				onAuth: vi.fn(),
				onPrompt: vi.fn(async () => ""),
			},
		});

		expect(getProviderSettings).toHaveBeenCalledWith("induscode");
		expect(saved).toMatchObject({
			provider: "induscode",
			apiKey: "manual-key",
			auth: {
				accessToken: "workos:new-access",
				refreshToken: "new-refresh",
				accountId: "acct-new",
				expiresAt: 4_000_000_000_000,
				metadata: { sessionStartedAtMs: 1_700_000_000_001 },
			},
		});
		expect(saveProviderSettings).toHaveBeenCalledWith(
			expect.objectContaining({ provider: "induscode" }),
			{ tokenSource: "oauth" },
		);
	});

	it("login/save preserves existing auth metadata when incoming metadata is missing", async () => {
		loginIndusCodeOAuth.mockResolvedValueOnce({
			access: "new-access",
			refresh: "new-refresh",
			expires: 4_000_000_000_000,
			accountId: "acct-new",
		});
		const getProviderSettings = vi.fn().mockReturnValue({
			provider: "induscode",
			auth: {
				accessToken: "workos:old-access",
				refreshToken: "old-refresh",
				accountId: "acct-old",
				metadata: {
					provider: "workos",
					sessionStartedAtMs: 1_700_000_000_003,
				},
			},
		});
		const saveProviderSettings = vi.fn();
		const manager = {
			getProviderSettings,
			saveProviderSettings,
		} as never;

		const saved = await loginAndSaveProviderOAuthCredentials(manager, "induscode", {
			callbacks: {
				onAuth: vi.fn(),
				onPrompt: vi.fn(async () => ""),
			},
		});

		expect(saved).toMatchObject({
			auth: {
				accessToken: "workos:new-access",
				metadata: {
					provider: "workos",
					sessionStartedAtMs: 1_700_000_000_003,
				},
			},
		});
	});

	it("login/save does not let undefined incoming metadata erase existing metadata", async () => {
		loginIndusCodeOAuth.mockResolvedValueOnce({
			access: "new-access",
			refresh: "new-refresh",
			expires: 4_000_000_000_000,
			accountId: "acct-new",
			metadata: { provider: undefined, tokenType: "Bearer" },
		});
		const getProviderSettings = vi.fn().mockReturnValue({
			provider: "induscode",
			auth: {
				accessToken: "workos:old-access",
				refreshToken: "old-refresh",
				accountId: "acct-old",
				metadata: {
					provider: "workos",
					sessionStartedAtMs: 1_700_000_000_004,
				},
			},
		});
		const saveProviderSettings = vi.fn();
		const manager = {
			getProviderSettings,
			saveProviderSettings,
		} as never;

		const saved = await loginAndSaveProviderOAuthCredentials(manager, "induscode", {
			callbacks: {
				onAuth: vi.fn(),
				onPrompt: vi.fn(async () => ""),
			},
		});

		expect(saved).toMatchObject({
			auth: {
				accessToken: "workos:new-access",
				metadata: {
					provider: "workos",
					sessionStartedAtMs: 1_700_000_000_004,
					tokenType: "Bearer",
				},
			},
		});
	});

	it("reads persisted auth metadata back into OAuth credentials", () => {
		const handler = getProviderAuthHandler("induscode");
		const credentials =
			handler &&
			getProviderOAuthCredentialsFromSettings("induscode", {
				provider: "induscode",
				auth: {
					accessToken: "workos:stored-access",
					refreshToken: "stored-refresh",
					expiresAt: 4_000_000_000_000,
					accountId: "acct-stored",
					metadata: { sessionStartedAtMs: 1_700_000_000_002 },
				},
			});

		expect(credentials).toMatchObject({
			access: "stored-access",
			refresh: "stored-refresh",
			accountId: "acct-stored",
			metadata: { sessionStartedAtMs: 1_700_000_000_002 },
		});
	});
});
