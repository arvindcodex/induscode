// ---------------------------------------------------------------------------
// induscode config - CLI tests
//
// Covers:
//   - `induscode config --config <dir>` - shows config for specific directory
//   - `induscode config --help`         - help page
// ---------------------------------------------------------------------------

import { test } from "@microsoft/tui-test";
import { INDUSCODE_BIN, TERMINAL_WIDE } from "../helpers/constants.js";
import { induscodeEnv } from "../helpers/env.js";
import { expectVisible } from "../helpers/terminal.js";

test.describe("induscode config --help", () => {
	test.use({
		program: { file: INDUSCODE_BIN, args: ["config", "--help"] },
		...TERMINAL_WIDE,
		env: induscodeEnv("default"),
	});

	test("shows config help page", async ({ terminal }) => {
		await expectVisible(terminal, ["Usage:", "--config"]);
	});
});
