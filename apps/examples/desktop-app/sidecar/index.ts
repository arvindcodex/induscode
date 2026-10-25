import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	checkManagedHubBuildMismatch,
	createIndusCodeTelemetryServiceConfig,
	ensureLoginShellPath,
	readGlobalSettings,
	setHomeDirIfUnset,
	setModelToolEnabledGlobally,
	watchManagedHubBuildMismatch,
} from "@induscode/core";
import {
	buildTelemetrySelfcheckReport,
	captureSdkError,
	disableCurrentDirectoryExecutableSearch,
	ensureLoopbackProxyBypass,
	setIndusCodeClientIdentity,
} from "@induscode/shared";
import { resolveIndusCodeDir, setIndusCodeDir } from "@induscode/shared/storage";
import { prewarmWorkspaceMetadata } from "./chat-session";
import { adoptDesktopCliRuntime, ensureHubWithDesktopCli } from "./cli-runtime";
import { DESKTOP_CLIENT_CONTEXT } from "./client-context";
import { configureConnectorCliLaunch } from "./connectors";
import {
	broadcastEvent,
	createSidecarContext,
	disposeSidecarContext,
	initializeSessionManager,
} from "./context";
import { createDesktopObservability } from "./observability";
import { configurePluginBootstrap } from "./plugin-bootstrap";
import { resolveWorkspaceRoot } from "./paths";
import { startServer } from "./server";
import { BunRuntime, SIDECAR_HOST, SIDECAR_MODE, SIDECAR_PORT } from "./types";

const defaultIndusDir =
	process.env.INDUSCODE_DIR?.trim() ||
	process.env.INDUSCODE_DIR?.trim() ||
	join(homedir(), ".induscode");
if (!process.env.INDUSCODE_DIR) {
	process.env.INDUSCODE_DIR = defaultIndusDir;
}
if (!process.env.INDUSCODE_DATA_DIR) {
	process.env.INDUSCODE_DATA_DIR = join(defaultIndusDir, "data");
}
if (!process.env.INDUSCODE_DIR) {
	process.env.INDUSCODE_DIR = defaultIndusDir;
}
if (!process.env.INDUSCODE_DATA_DIR) {
	process.env.INDUSCODE_DATA_DIR = join(defaultIndusDir, "data");
}
setIndusCodeDir(defaultIndusDir);

const SHUTDOWN_TIMEOUT_MS = 5_000;
let activeObservability:
	| ReturnType<typeof createDesktopObservability>
	| undefined;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			timeout = setTimeout(
				() => reject(new Error(`shutdown timed out after ${timeoutMs}ms`)),
				timeoutMs,
			);
		}),
	]).finally(() => {
		if (timeout) {
			clearTimeout(timeout);
		}
	});
}

async function main(desktopCliPath?: string) {
	if (!BunRuntime) {
		throw new Error("sidecar must be run with Bun");
	}

	// When launched from Finder/the Dock the app inherits launchd's minimal
	// PATH, so agent-spawned processes can't find shell-profile-installed
	// tools like `gh`. Kick resolution off first so it overlaps the rest of
	// startup, but await it before the session manager exists — that's what
	// spawns children (agent sessions, MCP servers, scheduled runs).
	const shellPathPromise = ensureLoginShellPath();

	const workspaceRoot = resolveWorkspaceRoot(process.cwd());
	setHomeDirIfUnset(homedir());
	configureConnectorCliLaunch(workspaceRoot);
	const observability = createDesktopObservability();
	activeObservability = observability;
	const ctx = createSidecarContext(workspaceRoot, observability);
	observability.logger.log("Desktop sidecar starting", {
		workspaceRoot,
		pid: process.pid,
	});

	// Web search is opt-in elsewhere in IndusCode, but the desktop app defaults
	// it to on. Seed the shared setting only when the user has never set it,
	// so an explicit off (from any IndusCode app) stays off. Best-effort: an
	// unwritable settings file must not block startup over a default.
	try {
		if (readGlobalSettings().tools?.web_search === undefined) {
			setModelToolEnabledGlobally("web_search", true);
		}
	} catch (error) {
		observability.logger.error?.("Failed to seed web search default", {
			error,
		});
	}

	prewarmWorkspaceMetadata(workspaceRoot);
	observability.logger.log(
		"Login shell PATH resolution",
		await shellPathPromise,
	);
	// The packaged app hands Hub startup to its bundled CLI: it reuses a
	// compatible healthy Hub or starts one, and the session manager attaches.
	// Afterwards the PATH above is set, so a new Hub inherits it. On failure
	// the session manager still starts the Hub through the same CLI launcher.
	if (desktopCliPath) {
		try {
			const hub = await ensureHubWithDesktopCli(desktopCliPath, workspaceRoot);
			observability.logger.log("Hub ready via IndusCode CLI", { url: hub.url });
		} catch (error) {
			observability.logger.error?.("IndusCode CLI hub ensure failed", { error });
		}
	}
	await initializeSessionManager(ctx);

	let shuttingDown = false;
	let handlingFatalError = false;
	const shutdown = async (reason = "code_sidecar_shutdown"): Promise<void> => {
		if (shuttingDown) {
			return;
		}
		shuttingDown = true;
		observability.logger.log("Desktop sidecar shutting down", { reason });
		await withTimeout(
			(async () => {
				try {
					await disposeSidecarContext(ctx, reason);
				} finally {
					await observability.dispose();
				}
			})(),
			SHUTDOWN_TIMEOUT_MS,
		);
	};

	const shutdownAndExit = (signal: string): void => {
		void shutdown(`code_sidecar_${signal.toLowerCase()}`).finally(() => {
			process.exit(signal === "SIGINT" ? 130 : 143);
		});
	};

	process.once("SIGINT", () => shutdownAndExit("SIGINT"));
	process.once("SIGTERM", () => shutdownAndExit("SIGTERM"));
	const handleFatalError = (kind: string, error: unknown): void => {
		if (handlingFatalError) {
			process.exit(1);
		}
		handlingFatalError = true;
		observability.logger.error?.("Desktop sidecar process error", {
			kind,
			error,
		});
		captureSdkError(observability.telemetry, {
			component: "desktop",
			operation: `sidecar.${kind}`,
			error,
			handled: false,
			severity: "fatal",
		});
		void shutdown(`code_sidecar_${kind}`).finally(() => process.exit(1));
	};
	process.on("uncaughtException", (error) => {
		handleFatalError("uncaught_exception", error);
	});
	process.on("unhandledRejection", (error) => {
		handleFatalError("unhandled_rejection", error);
	});
	process.once("beforeExit", () => {
		void shutdown("code_sidecar_before_exit");
	});

	const { port, approvalToken } = startServer(ctx, SIDECAR_PORT, shutdown);
	observability.logger.log("Desktop sidecar ready", {
		port,
		mode: SIDECAR_MODE,
	});

	// Watch auth.json for changes (from website dashboard logins, logouts, DP updates, account deletions)
	const watchDirs = [
		resolveIndusCodeDir(),
		defaultIndusDir,
		join(homedir(), ".induscode"),
		join(homedir(), ".induscode"),
	]
		.filter((dir, index, dirs) => dirs.indexOf(dir) === index)
		.map((dir) => join(dir, "data", "settings"));
	const lastAuthSignatures = new Map<string, string>();
	setInterval(() => {
		for (const sDir of watchDirs) {
			const authPath = join(sDir, "auth.json");
			if (existsSync(authPath)) {
				try {
					const stat = statSync(authPath);
					const signature = `${stat.mtimeMs}:${stat.size}`;
					if (signature !== lastAuthSignatures.get(authPath)) {
						const authRaw = readFileSync(authPath, "utf-8");
						const authData = JSON.parse(authRaw);
						lastAuthSignatures.set(authPath, signature);
						broadcastEvent(ctx, "account_changed", {
							authenticated: !!authData?.authenticated,
							user: authData?.user ?? null,
						});
						break;
					}
				} catch {}
			}
		}
	}, 1000);

	// Another IndusCode installation (e.g. an updated CLI) can replace the shared
	// Hub daemon while this app is running. Surface that to the webview so it
	// can prompt the user to update and restart.
	watchManagedHubBuildMismatch({
		onMismatch: (mismatch) => {
			ctx.hubBuildMismatch = mismatch;
			observability.logger.log("Managed hub build mismatch detected", {
				hubBuildId: mismatch.hubBuildId,
				hubCoreVersion: mismatch.hubCoreVersion,
				reason: mismatch.reason,
			});
			broadcastEvent(ctx, "hub_build_mismatch", mismatch);
		},
	});
	// The watcher's first check only runs after its interval, but a mismatch
	// that already exists at startup - an older Hub this app attached to
	// because it is still serving other clients' sessions - must prompt
	// before the user starts working, not half a minute in. Session-manager
	// init has already settled the hub state, so check once right away. The
	// broadcast reaches webviews that are already connected; the replay in
	// createWebSocketHandler covers ones that connect later. Skipped when
	// INDUSCODE_HUB_PORT pins an explicit endpoint, matching the watcher: such
	// hosts keep protocol-only compatibility and must not show update prompts.
	if (!process.env.INDUSCODE_HUB_PORT?.trim()) {
		void checkManagedHubBuildMismatch()
			.then((mismatch) => {
				if (!mismatch || ctx.hubBuildMismatch) {
					return;
				}
				ctx.hubBuildMismatch = mismatch;
				observability.logger.log(
					"Managed hub build mismatch detected at startup",
					{
						hubBuildId: mismatch.hubBuildId,
						hubCoreVersion: mismatch.hubCoreVersion,
						reason: mismatch.reason,
					},
				);
				broadcastEvent(ctx, "hub_build_mismatch", mismatch);
			})
			.catch(() => undefined);
	}

	// A wildcard bind isn't a dialable address; advertise loopback instead.
	const dialHost = SIDECAR_HOST === "0.0.0.0" ? "127.0.0.1" : SIDECAR_HOST;
	const endpoint = `http://${dialHost}:${port}`;
	const wsEndpoint = new URL(`ws://${dialHost}:${port}/transport`);
	wsEndpoint.searchParams.set("approval_token", approvalToken);
	process.stdout.write(
		`${JSON.stringify({
			type: "ready",
			endpoint,
			wsEndpoint: wsEndpoint.toString(),
			pid: process.pid,
			mode: SIDECAR_MODE,
		})}\n`,
	);
}

/**
 * Prints whether the telemetry configuration that was inlined at build time
 * (see scripts/telemetry-define-args.ts) actually made it into this bundle,
 * then exits. CI runs this against the packaged backend and fails the
 * publish when a release-grade build reports `"enabled":false` or an
 * unusable OTLP endpoint, so a regression in the build-time inlining can
 * never ship silently again.
 */
function runTelemetrySelfcheck(): void {
	const report = buildTelemetrySelfcheckReport(
		createIndusCodeTelemetryServiceConfig(),
	);
	process.stdout.write(`${JSON.stringify(report)}\n`);
}

async function runEntrypoint(): Promise<void> {
	// The selfcheck only inspects build-time config and must not start anything.
	if (process.argv.includes("--telemetry-selfcheck")) {
		runTelemetrySelfcheck();
		return;
	}
	const { cliPath } = adoptDesktopCliRuntime();
	setIndusCodeClientIdentity(DESKTOP_CLIENT_CONTEXT);

	disableCurrentDirectoryExecutableSearch();
	// Before the bundled CLI starts the Hub daemon and loads any plugin.
	configurePluginBootstrap();
	// Before the Hub daemon and agent-spawned processes inherit this env.
	ensureLoopbackProxyBypass();
	await main(cliPath);
}

runEntrypoint().catch(async (error) => {
	const message = error instanceof Error ? error.message : String(error);
	activeObservability?.logger.error?.("Desktop sidecar process failed", {
		error,
	});
	captureSdkError(activeObservability?.telemetry, {
		component: "desktop",
		operation: "sidecar.startup",
		error,
		handled: false,
		severity: "fatal",
	});
	await activeObservability?.dispose();
	process.stderr.write(`${message}\n`);
	process.exit(1);
});
