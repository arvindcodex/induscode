// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const { invoke, isTauriAvailable } = vi.hoisted(() => ({
	invoke: vi.fn(),
	isTauriAvailable: vi.fn(() => false),
}));
vi.mock("@/lib/desktop-client", () => ({
	desktopClient: { invoke },
	isTauriAvailable,
}));

import {
	APP_ICON_STORAGE_KEY,
	appIconAssetPath,
	appIconSurface,
	DEFAULT_APP_ICON,
	isAppIconId,
	readStoredAppIcon,
	setStoredAppIcon,
	syncAppIcon,
} from "./app-icon";

afterEach(() => {
	window.localStorage.clear();
	document.querySelector('link[rel="icon"]')?.remove();
	invoke.mockReset();
	isTauriAvailable.mockReturnValue(false);
});

describe("app icon", () => {
	it("defaults to the classic brand icon", () => {
		expect(DEFAULT_APP_ICON).toBe("classic");
		expect(readStoredAppIcon()).toBe("classic");
	});

	it.each([
		["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Taskbar"],
		["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "Dock"],
		["Mozilla/5.0 (X11; Linux x86_64)", "desktop"],
	])("names the app icon surface for %s", (userAgent, surface) => {
		expect(appIconSurface(userAgent)).toBe(surface);
	});

	it("keeps the official favicon on sync", async () => {
		await syncAppIcon();
		expect(
			document
				.querySelector<HTMLLinkElement>('link[rel="icon"]')
				?.getAttribute("href"),
		).toBe("/icon.png");
	});
});
