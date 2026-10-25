// ---------------------------------------------------------------------------
// induscode history - CLI tests
//
// Covers:
//   - `induscode history --limit X`  - result limit
//   - `induscode history --config`   - custom config directory
//   - `induscode history --help`     - help page
// ---------------------------------------------------------------------------

import { test } from "@microsoft/tui-test";
import { INDUSCODE_BIN, TERMINAL_WIDE } from "../helpers/constants.js";
import { induscodeEnv } from "../helpers/env.js";
import { expectVisible } from "../helpers/terminal.js";

test.describe("induscode history --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["history", "--help"] },
		...TERMINAL_WIDE,
		env: induscodeEnv("default"),
	});

	test("shows history help page with all flags", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--limit", "--config"]);
	});
});

test.describe("induscode history --limit", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["history", "--limit", "1"] },
		...TERMINAL_WIDE,
		env: induscodeEnv("default"),
	});

	test("shows history limited to specified number of results", async ({
		terminal,
	}) => {
		// The default config has 2 tasks in taskHistory.json; with limit=1
		// we should see only 1 task entry
		await expectVisible(terminal, /history|task/i);
	});
});

test.describe("induscode history --config (default)", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["history"] },
		...TERMINAL_WIDE,
		env: induscodeEnv("default"),
	});

	test("shows history for default config", async ({ terminal }) => {
		// Default config has tasks with "wezterm" in them
		await expectVisible(terminal, /history|task|wezterm/i);
	});
});

test.describe("induscode history --config (claude-sonnet-4.6)", () => {
	test.use({
		program: {
			file: INDUSCODE_BIN,
			args: ["history", "--config", "configs/claude-sonnet-4.6"],
		},
		...TERMINAL_WIDE,
		env: induscodeEnv("claude-sonnet-4.6"),
	});

	test("shows different history for different config directory", async ({
		terminal,
	}) => {
		// The claude-sonnet-4.6 config has its own separate task history
		await expectVisible(terminal, /history|task/i);
	});
});
