import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderSettingsManager } from "@induscode/core";
import { afterEach, describe, expect, it } from "vitest";
import {
	getPersistedProviderApiKey,
	isProviderConfigured,
} from "../../../utils/provider-auth";
import {
	buildIndusCodePassSubscriptionPageUrl,
	resolveOAuthWaitKeyAction,
	saveManualProviderApiKey,
} from "./provider-picker-helpers";

describe("resolveOAuthWaitKeyAction", () => {
	it("switches to manual API key entry on K when the fallback is available", () => {
		expect(resolveOAuthWaitKeyAction({ name: "k" }, true)).toBe("use_api_key");
	});

	it("cancels on K when the fallback is not available", () => {
		expect(resolveOAuthWaitKeyAction({ name: "k" }, false)).toBe("cancel");
	});

	it("cancels on any other unmodified key so users are never stuck waiting on a browser flow", () => {
		for (const name of ["escape", "q", "return", "space", "up", "x"]) {
			expect(resolveOAuthWaitKeyAction({ name }, true)).toBe("cancel");
			expect(resolveOAuthWaitKeyAction({ name }, false)).toBe("cancel");
		}
	});

	it("ignores modifier-held keys so holding Cmd/Ctrl to click the auth link never cancels", () => {
		expect(resolveOAuthWaitKeyAction({ name: "k", ctrl: true }, true)).toBe(
			"ignore",
		);
		expect(resolveOAuthWaitKeyAction({ name: "c", ctrl: true }, false)).toBe(
			"ignore",
		);
		expect(resolveOAuthWaitKeyAction({ name: "x", meta: true }, true)).toBe(
			"ignore",
		);
		expect(resolveOAuthWaitKeyAction({ name: "x", super: true }, false)).toBe(
			"ignore",
		);
		// A bare modifier press (empty name) is ignored, not a cancel.
		expect(resolveOAuthWaitKeyAction({ name: "" }, true)).toBe("ignore");
	});
});

describe("buildIndusCodePassSubscriptionPageUrl", () => {
	it("opens the personal subscription page on production by default", () => {
		expect(
			buildIndusCodePassSubscriptionPageUrl(undefined).startsWith(
				"https://app.induscode.bot/dashboard/subscription?personal=true",
			),
		).toBe(true);
	});

	it("keeps the configured app base URL", () => {
		expect(
			buildIndusCodePassSubscriptionPageUrl(
				"https://staging-app.induscode.bot",
			).startsWith(
				"https://staging-app.induscode.bot/dashboard/subscription?personal=true",
			),
		).toBe(true);
	});
});

describe("saveManualProviderApiKey", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { force: true, recursive: true });
		}
	});

	function createManager(): ProviderSettingsManager {
		const dir = mkdtempSync(join(tmpdir(), "induscode-cli-provider-picker-"));
		tempDirs.push(dir);
		return new ProviderSettingsManager({
			filePath: join(dir, "providers.json"),
		});
	}

	it("clears stored OAuth tokens so the manual key takes effect", async () => {
		const manager = createManager();
		manager.saveProviderSettings({
			provider: "induscode",
			auth: {
				accessToken: "stale-access-token",
				refreshToken: "stale-refresh-token",
				accountId: "acct_123",
			},
		});

		await saveManualProviderApiKey(manager, "induscode", "manual-api-key");

		const settings = manager.getProviderSettings("induscode");
		expect(settings?.apiKey).toBe("manual-api-key");
		expect(settings?.auth?.accessToken).toBeUndefined();
		expect(settings?.auth?.refreshToken).toBeUndefined();
		expect(settings?.auth?.accountId).toBe("acct_123");
		expect(getPersistedProviderApiKey("induscode", settings)).toBe(
			"manual-api-key",
		);
		expect(isProviderConfigured("induscode", settings)).toBe(true);
	});

	it("saves induscode-pass keys to the shared induscode auth storage entry", async () => {
		const manager = createManager();
		manager.saveProviderSettings({
			provider: "induscode",
			auth: {
				accessToken: "stale-access-token",
				refreshToken: "stale-refresh-token",
			},
		});

		await saveManualProviderApiKey(manager, "induscode-pass", "manual-api-key");

		// induscode-pass inherits auth storage from the "induscode" entry, so the key
		// must land there and the stale tokens must be gone for both providers.
		const induscodeSettings = manager.getProviderSettings("induscode");
		expect(induscodeSettings?.apiKey).toBe("manual-api-key");
		expect(induscodeSettings?.auth?.accessToken).toBeUndefined();

		const induscodePassSettings = manager.getProviderSettings("induscode-pass");
		expect(getPersistedProviderApiKey("induscode-pass", induscodePassSettings)).toBe(
			"manual-api-key",
		);
		expect(isProviderConfigured("induscode-pass", induscodePassSettings)).toBe(true);
	});

	it("clears stale credentials copied into a direct induscode-pass entry", async () => {
		const manager = createManager();
		manager.saveProviderSettings({
			provider: "induscode",
			auth: {
				accessToken: "stale-access-token",
				refreshToken: "stale-refresh-token",
			},
		});
		// Provider switching copies the merged settings (including auth) into
		// a direct induscode-pass entry, which shadows the shared "induscode" entry.
		manager.saveProviderSettings({
			provider: "induscode-pass",
			apiKey: "stale-copied-key",
			auth: {
				accessToken: "stale-access-token",
				refreshToken: "stale-refresh-token",
			},
		});

		await saveManualProviderApiKey(manager, "induscode-pass", "manual-api-key");

		const induscodePassSettings = manager.getProviderSettings("induscode-pass");
		expect(induscodePassSettings?.auth?.accessToken).toBeUndefined();
		expect(getPersistedProviderApiKey("induscode-pass", induscodePassSettings)).toBe(
			"manual-api-key",
		);
	});
});
