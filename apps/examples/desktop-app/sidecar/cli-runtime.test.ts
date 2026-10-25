import { describe, expect, it, vi } from "vitest";
import { adoptDesktopCliRuntime, ensureHubWithDesktopCli } from "./cli-runtime";

describe("ensureHubWithDesktopCli", () => {
	it("asks the bundled CLI to start or reuse the Hub and returns only its URL", async () => {
		const run = vi.fn(
			async () =>
				'warming up\n{"url":"ws://127.0.0.1:25463/hub","authToken":"secret","cwd":"/work"}\n',
		);

		await expect(
			ensureHubWithDesktopCli("/opt/induscode/induscode-cli", "/work", {
				env: { PATH: "/usr/bin" },
				run,
			}),
		).resolves.toEqual({ url: "ws://127.0.0.1:25463/hub" });
		expect(run).toHaveBeenCalledWith(
			"/opt/induscode/induscode-cli",
			["hub", "ensure", "--json", "--cwd", "/work"],
			{
				cwd: "/work",
				env: {
					PATH: "/usr/bin",
					INDUSCODE_NO_AUTO_UPDATE: "1",
					INDUSCODE_HUB_LAUNCHER_CLIENT: "induscode-desktop",
					INDUSCODE_HUB_LAUNCHER_VERSION: expect.stringMatching(/^\d+\.\d+\.\d+/),
					INDUSCODE_HUB_LAUNCHER_TRANSPORT: "local",
				},
				timeoutMs: 60_000,
			},
		);
	});

	it("rejects when the CLI does not report a Hub URL", async () => {
		await expect(
			ensureHubWithDesktopCli("/opt/induscode/induscode-cli", "/work", {
				env: {},
				run: async () => "",
			}),
		).rejects.toThrow("did not report a Hub URL");
	});
});

describe("adoptDesktopCliRuntime", () => {
	it("routes Hub spawns through the bundled CLI and restores the workspace cwd", () => {
		const env: NodeJS.ProcessEnv = {
			BUN_BE_BUN: "1",
			INDUSCODE_DESKTOP_CLI_PATH:
				"/Applications/IndusCode.app/Contents/MacOS/induscode-cli",
			INDUSCODE_DESKTOP_WORKSPACE_ROOT: "/Users/dev/project",
		};
		const chdir = vi.fn();
		const setLauncher = vi.fn();

		expect(adoptDesktopCliRuntime({ env, chdir, setLauncher })).toEqual({
			cliPath: "/Applications/IndusCode.app/Contents/MacOS/induscode-cli",
		});

		expect(env.BUN_BE_BUN).toBeUndefined();
		expect(env.INDUSCODE_DESKTOP_WORKSPACE_ROOT).toBeUndefined();
		expect(env.INDUSCODE_DESKTOP_CLI_PATH).toBe(
			"/Applications/IndusCode.app/Contents/MacOS/induscode-cli",
		);
		expect(chdir).toHaveBeenCalledWith("/Users/dev/project");
		expect(setLauncher).toHaveBeenCalledWith({
			command: "/Applications/IndusCode.app/Contents/MacOS/induscode-cli",
		});
	});

	it("keeps the default Hub launcher when no bundled CLI is provided", () => {
		const chdir = vi.fn();
		const setLauncher = vi.fn();

		expect(adoptDesktopCliRuntime({ env: {}, chdir, setLauncher })).toEqual({
			cliPath: undefined,
		});
		expect(chdir).not.toHaveBeenCalled();
		expect(setLauncher).not.toHaveBeenCalled();
	});
});
