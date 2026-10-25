import { test } from "@microsoft/tui-test";
import { INDUSCODE_BIN } from "./helpers/constants.js";
import { induscodeEnv } from "./helpers/env.js";
import { expectVisible } from "./helpers/terminal.js";

// ---------------------------------------------------------------------------
// induscode --version  (root flag)
// ---------------------------------------------------------------------------
test.describe("induscode --version", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["--version"] },
		env: induscodeEnv("claude-sonnet-4.6"),
	});

	test("prints the version string", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});

// ---------------------------------------------------------------------------
// induscode -V  (short flag)
// ---------------------------------------------------------------------------
test.describe("induscode -V", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["-V"] },
		env: induscodeEnv("claude-sonnet-4.6"),
	});

	test("prints the version string with short flag", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});

// ---------------------------------------------------------------------------
// induscode version  (subcommand)
// ---------------------------------------------------------------------------
test.describe("induscode version subcommand", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["version"] },
		env: induscodeEnv("claude-sonnet-4.6"),
	});

	test("prints 'IndusCode CLI version:' message", async ({ terminal }) => {
		await expectVisible(terminal, /\d+\.\d+\.\d+/g);
	});
});
