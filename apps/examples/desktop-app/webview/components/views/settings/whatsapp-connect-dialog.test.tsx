// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppConnectDialog } from "./whatsapp-connect-dialog";

const { openExternalUrlMock } = vi.hoisted(() => ({
	openExternalUrlMock: vi.fn(),
}));

vi.mock("@/lib/desktop-client", () => ({
	openExternalUrl: openExternalUrlMock,
}));

vi.mock("@/contexts/account-context", () => ({
	useAccount: () => ({
		user: { email: "arvind@zorix.in", displayName: "Arvind" },
	}),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	openExternalUrlMock.mockReset();
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.restoreAllMocks();
});

describe("WhatsAppConnectDialog", () => {
	it("renders WhatsApp remote connection dialog with QR code and pairing message", async () => {
		await act(async () => {
			root.render(
				<WhatsAppConnectDialog
					open={true}
					onOpenChange={() => {}}
					currentHost="dev.example.com"
				/>,
			);
		});

		expect(document.body.textContent).toContain("Connect Host via WhatsApp");
		expect(document.body.textContent).toContain("Hi IndusCode");
		expect(document.body.textContent).toContain("User Identity: arvind@zorix.in");
		expect(document.body.textContent).toContain("Host: dev.example.com");
		expect(document.body.textContent).toContain("+1 (555) 339-7909");
		expect(document.body.textContent).toContain("Arvind Codex Agency");
		expect(document.body.textContent).toContain("Open in WhatsApp");
	});

	it("triggers openExternalUrl with wa.me formatted link when clicking Open in WhatsApp", async () => {
		await act(async () => {
			root.render(
				<WhatsAppConnectDialog
					open={true}
					onOpenChange={() => {}}
					currentHost="dev.example.com"
				/>,
			);
		});

		const openBtn = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(
			(b) => b.textContent?.includes("Open in WhatsApp"),
		);
		expect(openBtn).toBeDefined();

		await act(async () => {
			openBtn?.click();
		});

		expect(openExternalUrlMock).toHaveBeenCalledTimes(1);
		const calledUrl = openExternalUrlMock.mock.calls[0][0] as string;
		expect(calledUrl).toContain("https://wa.me/");
		expect(calledUrl).toContain("Hi%20IndusCode");
		expect(calledUrl).toContain("arvind%40zorix.in");
	});
});
