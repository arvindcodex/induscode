import { expect, test } from "@microsoft/tui-test";
import { INDUSCODE_BIN } from "./helpers/constants.js";
import { induscodeEnv } from "./helpers/env.js";
import { waitForChatReady } from "./helpers/page-objects/chat.js";
import { expectVisible, waitForTerminalExit } from "./helpers/terminal.js";

test.describe("induscode interactive basics", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: [] },
		rows: 50,
		columns: 120,
		env: induscodeEnv("default"),
	});

	test("shows logo, prompt, and hints", async ({ terminal }) => {
		await waitForChatReady(terminal);
		await expectVisible(terminal, ["@ for file mentions", "Tab"]);
	});

	test("shows slash commands after / input", async ({ terminal }) => {
		await waitForChatReady(terminal);
		// Type "/" without submitting to trigger the slash menu
		terminal.write("/");
		await expectVisible(terminal, ["/settings", "/mcp"], {
			timeout: 10_000,
		});
	});

	test("opens the command palette with Ctrl+P", async ({ terminal }) => {
		await waitForChatReady(terminal);
		terminal.write("\x10");
		await expectVisible(terminal, [
			"Command Palette",
			"Change Model",
			"Manage MCP Servers",
		]);
	});
});

test.describe("induscode interactive provider flag", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["-P", "induscode"] },
		rows: 50,
		columns: 120,
		env: induscodeEnv("default"),
	});

	test("exits idle TUI after one Ctrl+C", async ({ terminal }) => {
		await waitForChatReady(terminal);
		terminal.keyCtrlC();
		await expect(waitForTerminalExit(terminal, 5_000)).resolves.toBe(0);
	});
});
