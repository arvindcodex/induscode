import { test } from "@microsoft/tui-test";
import { INDUSCODE_BIN } from "./helpers/constants.js";
import { induscodeEnv } from "./helpers/env.js";
import { expectVisible } from "./helpers/terminal.js";

const HELP_TERMINAL = { columns: 120, rows: 50 };

// ===========================================================================
// induscode --help  (root help)
// ===========================================================================
test.describe("induscode --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["--help"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows Usage line and lists all subcommands", async ({ terminal }) => {
		await expectVisible(terminal, [
			"Usage:",
			"history|h",
			"auth [options]",
			"version",
			"update [options]",
			"hub ",
		]);
	});

	test("shows all root-level option flags", async ({ terminal }) => {
		await expectVisible(terminal, [
			"--plan",
			"--timeout",
			"--model",
			"--verbose",
			"--cwd",
			"--config",
			"--thinking",
			"--retries",
			"--json",
			"--acp",
			"--update",
		]);
	});
});

// ===========================================================================
// induscode -h  (short help flag)
// ===========================================================================
test.describe("induscode -h", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["-h"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows Usage line with short flag", async ({ terminal }) => {
		await expectVisible(terminal, "Usage:");
	});
});

// ===========================================================================
// induscode history --help
// ===========================================================================
test.describe("induscode history --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["history", "--help"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows history usage and all flags", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--limit", "--config"]);
	});
});

// ===========================================================================
// induscode h --help  (history alias)
// ===========================================================================
test.describe("induscode h --help (history alias)", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["h", "--help"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows history usage and flags via alias", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--limit"]);
	});
});

// ===========================================================================
// induscode config --help
// ===========================================================================
test.describe("induscode config --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["config", "--help"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows config usage and --config flag", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--config"]);
	});
});

// ===========================================================================
// induscode auth --help
// ===========================================================================
test.describe("induscode auth --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["auth", "--help"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows auth usage and all flags", async ({ terminal }) => {
		await expectVisible(terminal, [
			"Usage:",
			"--provider",
			"--apikey",
			"--modelid",
			"--baseurl",
			"--config",
		]);
	});
});

// ===========================================================================
// induscode version --help
// ===========================================================================
test.describe("induscode version --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["version", "--help"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows version command usage", async ({ terminal }) => {
		await expectVisible(terminal, "Usage:");
	});
});

// ===========================================================================
// induscode update --help
// ===========================================================================
test.describe("induscode update --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["update", "--help"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows update usage and --verbose flag", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--verbose"]);
	});
});

// ===========================================================================
// induscode doctor --help
// ===========================================================================
test.describe("induscode doctor --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["doctor", "--help"] },
		env: induscodeEnv("claude-sonnet-4.6"),
		...HELP_TERMINAL,
	});

	test("shows doctor usage and lists fix and log subcommands", async ({
		terminal,
	}) => {
		await expectVisible(terminal, ["Usage:", "fix", "log"]);
	});
});
