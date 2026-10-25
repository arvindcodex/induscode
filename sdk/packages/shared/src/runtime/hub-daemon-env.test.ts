import { afterEach, describe, expect, it } from "vitest";
import {
	INDUSCODE_CONNECTOR_CLI_LAUNCH_ENV,
	INDUSCODE_CONNECTOR_STARTING_INSTANCE_ENV,
	INDUSCODE_CONNECTOR_SUPERVISED_ENV,
	INDUSCODE_RUN_AS_HUB_DAEMON_ENV,
	claimHubDaemonProcess,
	claimHubLauncherIdentity,
	claimSupervisedConnectorProcess,
	isHubDaemonProcess,
	isSupervisedConnectorProcess,
	readConnectorCliLaunchSpec,
	readHubLauncherIdentity,
	readStartingConnectorInstance,
	setConnectorCliLaunchSpec,
	setStartingConnectorInstance,
	withHubLauncherIdentity,
} from "./hub-daemon-env";

describe("hub daemon environment helpers", () => {
	it("detects hub daemon mode from the shared sentinel", () => {
		expect(
			isHubDaemonProcess({
				[INDUSCODE_RUN_AS_HUB_DAEMON_ENV]: "1",
			}),
		).toBe(true);
		expect(
			isHubDaemonProcess({
				[INDUSCODE_RUN_AS_HUB_DAEMON_ENV]: "0",
			}),
		).toBe(false);
	});

	it("round-trips a connector CLI launch specification", () => {
		const env: Record<string, string | undefined> = {};
		const spec = {
			launcher: "/usr/local/bin/bun",
			connectArgsPrefix: ["/repo/apps/cli/src/index.ts", "connect"],
			cwd: "/workspace",
		};

		setConnectorCliLaunchSpec(spec, env);

		expect(readConnectorCliLaunchSpec(env)).toEqual(spec);
		expect(env[INDUSCODE_CONNECTOR_CLI_LAUNCH_ENV]).toBe(JSON.stringify(spec));
	});

	it("round-trips the connector instance that is starting", () => {
		const env: Record<string, string | undefined> = {};
		const ref = { channel: "slack", instanceId: "induscode-slack" };

		setStartingConnectorInstance(ref, env);

		expect(readStartingConnectorInstance(env)).toEqual(ref);
		expect(env[INDUSCODE_CONNECTOR_STARTING_INSTANCE_ENV]).toBe(
			JSON.stringify(ref),
		);
	});

	it("reports no starting connector instance when the marker is absent or malformed", () => {
		expect(readStartingConnectorInstance({})).toBeUndefined();
		expect(
			readStartingConnectorInstance({
				[INDUSCODE_CONNECTOR_STARTING_INSTANCE_ENV]: "not json",
			}),
		).toBeUndefined();
		expect(
			readStartingConnectorInstance({
				[INDUSCODE_CONNECTOR_STARTING_INSTANCE_ENV]: JSON.stringify({
					channel: "slack",
					instanceId: "   ",
				}),
			}),
		).toBeUndefined();
	});

	it("rejects malformed connector CLI launch specifications", () => {
		expect(
			readConnectorCliLaunchSpec({
				[INDUSCODE_CONNECTOR_CLI_LAUNCH_ENV]: JSON.stringify({
					launcher: "bun",
					connectArgsPrefix: [42],
					cwd: "/workspace",
				}),
			}),
		).toBeUndefined();
	});
});

describe("claiming the hub daemon sentinel", () => {
	const original = process.env[INDUSCODE_RUN_AS_HUB_DAEMON_ENV];

	afterEach(() => {
		if (original === undefined) {
			delete process.env[INDUSCODE_RUN_AS_HUB_DAEMON_ENV];
		} else {
			process.env[INDUSCODE_RUN_AS_HUB_DAEMON_ENV] = original;
		}
		// Reset the module latch so cases do not leak into each other.
		claimHubDaemonProcess({});
	});

	it("removes the sentinel so spawned children cannot inherit it", () => {
		const env: Record<string, string | undefined> = {
			[INDUSCODE_RUN_AS_HUB_DAEMON_ENV]: "1",
			PATH: "/usr/bin",
		};

		expect(claimHubDaemonProcess(env)).toBe(true);
		expect(INDUSCODE_RUN_AS_HUB_DAEMON_ENV in env).toBe(false);
		// Unrelated environment is untouched.
		expect(env.PATH).toBe("/usr/bin");
	});

	it("still reports daemon mode after the sentinel is gone", () => {
		process.env[INDUSCODE_RUN_AS_HUB_DAEMON_ENV] = "1";

		claimHubDaemonProcess();

		expect(process.env[INDUSCODE_RUN_AS_HUB_DAEMON_ENV]).toBeUndefined();
		// The guards that stop a daemon spawning another daemon rely on this.
		expect(isHubDaemonProcess()).toBe(true);
	});

	it("reports non-daemon mode when the sentinel was never set", () => {
		delete process.env[INDUSCODE_RUN_AS_HUB_DAEMON_ENV];

		expect(claimHubDaemonProcess()).toBe(false);
		expect(isHubDaemonProcess()).toBe(false);
	});

	it("reads an explicitly passed environment verbatim, ignoring the latch", () => {
		process.env[INDUSCODE_RUN_AS_HUB_DAEMON_ENV] = "1";
		claimHubDaemonProcess();

		expect(isHubDaemonProcess({})).toBe(false);
		expect(isHubDaemonProcess({ [INDUSCODE_RUN_AS_HUB_DAEMON_ENV]: "1" })).toBe(
			true,
		);
	});
});

describe("supervised connector marker", () => {
	const original = process.env[INDUSCODE_CONNECTOR_SUPERVISED_ENV];

	afterEach(() => {
		if (original === undefined) {
			delete process.env[INDUSCODE_CONNECTOR_SUPERVISED_ENV];
		} else {
			process.env[INDUSCODE_CONNECTOR_SUPERVISED_ENV] = original;
		}
		// Reset the module latch so cases do not leak into each other.
		claimSupervisedConnectorProcess({});
	});

	it("removes the marker so spawned children cannot inherit it", () => {
		const env: Record<string, string | undefined> = {
			[INDUSCODE_CONNECTOR_SUPERVISED_ENV]: "1",
			PATH: "/usr/bin",
		};

		expect(claimSupervisedConnectorProcess(env)).toBe(true);
		expect(INDUSCODE_CONNECTOR_SUPERVISED_ENV in env).toBe(false);
		expect(env.PATH).toBe("/usr/bin");
	});

	it("still reports supervision after the marker is gone", () => {
		process.env[INDUSCODE_CONNECTOR_SUPERVISED_ENV] = "1";

		claimSupervisedConnectorProcess();

		expect(process.env[INDUSCODE_CONNECTOR_SUPERVISED_ENV]).toBeUndefined();
		// The connector still has to run in-process rather than delegating.
		expect(isSupervisedConnectorProcess()).toBe(true);
	});

	it("reports no supervision when the marker was never set", () => {
		delete process.env[INDUSCODE_CONNECTOR_SUPERVISED_ENV];

		expect(claimSupervisedConnectorProcess()).toBe(false);
		expect(isSupervisedConnectorProcess()).toBe(false);
	});

	it("reads an explicitly passed environment verbatim, ignoring the latch", () => {
		process.env[INDUSCODE_CONNECTOR_SUPERVISED_ENV] = "1";
		claimSupervisedConnectorProcess();

		expect(isSupervisedConnectorProcess({})).toBe(false);
		expect(
			isSupervisedConnectorProcess({ [INDUSCODE_CONNECTOR_SUPERVISED_ENV]: "1" }),
		).toBe(true);
	});
});

describe("hub launcher identity", () => {
	it("stamps the launcher onto a daemon environment without overriding an embedding host", () => {
		const stamped = withHubLauncherIdentity(
			{ PATH: "/usr/bin" },
			{ client: "induscode-cli", version: "3.0.72" },
		);
		expect(stamped).toEqual({
			PATH: "/usr/bin",
			INDUSCODE_HUB_LAUNCHER_CLIENT: "induscode-cli",
			INDUSCODE_HUB_LAUNCHER_VERSION: "3.0.72",
			INDUSCODE_HUB_LAUNCHER_TRANSPORT: "local",
		});
		// The desktop app runs `induscode-cli hub ensure`; the CLI process that
		// actually spawns the daemon must not replace the desktop's stamp.
		const preserved = withHubLauncherIdentity(stamped, {
			client: "induscode-desktop",
			version: "0.0.46",
		});
		expect(preserved).toEqual(stamped);
		// A host that stamped only its client must not have another build's
		// version filled in next to its name.
		const clientOnly = withHubLauncherIdentity(
			{ INDUSCODE_HUB_LAUNCHER_CLIENT: "induscode-desktop" },
			{ client: "induscode-cli", version: "3.0.72" },
		);
		expect(clientOnly).toEqual({ INDUSCODE_HUB_LAUNCHER_CLIENT: "induscode-desktop" });
		expect(withHubLauncherIdentity({ A: "1" }, undefined)).toEqual({ A: "1" });
		expect(withHubLauncherIdentity({ A: "1" }, { client: "  " })).toEqual({
			A: "1",
		});
	});

	it("claims the launcher stamp so hosted sessions do not pass it on", () => {
		const env: Record<string, string | undefined> = {
			INDUSCODE_HUB_LAUNCHER_CLIENT: "induscode-desktop",
			INDUSCODE_HUB_LAUNCHER_VERSION: "0.0.46",
			INDUSCODE_HUB_LAUNCHER_TRANSPORT: "ssh",
			PATH: "/usr/bin",
		};
		expect(claimHubLauncherIdentity(env)).toEqual({
			client: "induscode-desktop",
			version: "0.0.46",
			transport: "ssh",
		});
		expect(env).toEqual({ PATH: "/usr/bin" });
		// A hub started by a command inside that session records itself.
		expect(
			withHubLauncherIdentity(env, { client: "induscode-cli", version: "3.0.72" })
				.INDUSCODE_HUB_LAUNCHER_CLIENT,
		).toBe("induscode-cli");
		expect(claimHubLauncherIdentity({})).toBeUndefined();
	});

	it("reads the launcher back, ignoring unknown transports", () => {
		expect(readHubLauncherIdentity({})).toBeUndefined();
		expect(
			readHubLauncherIdentity({
				INDUSCODE_HUB_LAUNCHER_CLIENT: " induscode-desktop ",
				INDUSCODE_HUB_LAUNCHER_VERSION: "0.0.46",
				INDUSCODE_HUB_LAUNCHER_TRANSPORT: "ssh",
			}),
		).toEqual({ client: "induscode-desktop", version: "0.0.46", transport: "ssh" });
		expect(
			readHubLauncherIdentity({
				INDUSCODE_HUB_LAUNCHER_CLIENT: "induscode-cli",
				INDUSCODE_HUB_LAUNCHER_TRANSPORT: "carrier-pigeon",
			}),
		).toEqual({ client: "induscode-cli" });
	});
});
