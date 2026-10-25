// ---------------------------------------------------------------------------
// Environment helpers for test setup.
//
// Usage:
//   test.use({ env: induscodeEnv("default") });
//   test.use({ env: induscodeEnv("claude-sonnet-4.6") });
//   test.use({ env: induscodeEnv("/absolute/path/to/config") });
// ---------------------------------------------------------------------------

import { cpSync, mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const TEST_SUITE_ROOT = new URL("../", import.meta.url).pathname;

let envCounter = 0;

function createIsolatedIndusCodeDir(sourceDir: string): string {
	const tempRoot = mkdtempSync(path.join(os.tmpdir(), "induscode-tui-test-"));
	const targetDir = path.join(tempRoot, "induscode");
	cpSync(sourceDir, targetDir, {
		recursive: true,
		errorOnExist: false,
		force: true,
	});
	mkdirSync(path.join(targetDir, "home"), { recursive: true });
	return targetDir;
}

function nextHubPort(): string {
	envCounter += 1;
	const basePort = 30_000 + (process.pid % 10_000);
	return String(basePort + (envCounter % 10_000));
}

/**
 * Build the process environment for a induscode test.
 *
 * @param configDir - Named config under `configs/`, or an absolute path.
 * @param extra     - Additional env vars to merge in (override defaults).
 */
export function induscodeEnv(
	configDir: string,
	extra: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
	const induscodePath = path.isAbsolute(configDir)
		? configDir
		: path.join(TEST_SUITE_ROOT, "configs", configDir);
	const isolatedIndusCodePath = createIsolatedIndusCodeDir(induscodePath);
	const dataDir = path.join(isolatedIndusCodePath, "data");

	// Determine effective VCR mode: extra overrides > parent env > default "playback"
	const effectiveVcrMode =
		extra.INDUSCODE_VCR ?? process.env.INDUSCODE_VCR ?? "playback";

	// During recording, authenticated configs read real OAuth credentials from
	// ~/.induscode/data/settings/providers.json while keeping all other settings
	// (model, provider, global state) from the mock config directory.
	const isRecording = effectiveVcrMode === "record";
	const isAuthenticated = configDir !== "unauthenticated";
	const realProvidersFile =
		isRecording && isAuthenticated
			? path.join(os.homedir(), ".induscode", "data", "settings", "providers.json")
			: undefined;

	// Remove CI so terminal renderers treat the spawned process as interactive.
	// Remove VITEST so the spawned CLI binary doesn't skip initVcr().
	// cli/src/index.ts guards `initVcr` behind `process.env.VITEST !== "true"`,
	// so if the parent vitest process's VITEST=true leaks into the child, VCR
	// recording/playback is silently skipped.
	const { CI: _ci, VITEST: _vitest, ...cleanEnv } = process.env;
	if (!isAuthenticated) {
		delete cleanEnv.INDUSCODE_API_KEY;
	}

	// Only enable VCR when a cassette path is provided (via extra or parent env),
	// otherwise tests without cassettes would trigger a spurious
	// "[VCR] No INDUSCODE_VCR_CASSETTE" warning on every run.
	const hasCassette = !!(
		extra.INDUSCODE_VCR_CASSETTE ?? process.env.INDUSCODE_VCR_CASSETTE
	);
	const vcrDefaults = hasCassette
		? { INDUSCODE_VCR: "playback", INDUSCODE_VCR_FILTER: "" }
		: {};

	// the order of these env vars matter; later ones override earlier ones
	return {
		...vcrDefaults,
		...cleanEnv,
		...(realProvidersFile
			? { INDUSCODE_PROVIDER_SETTINGS_PATH: realProvidersFile }
			: {}),
		INDUSCODE_TELEMETRY_DISABLED: "1",
		HOME: path.join(isolatedIndusCodePath, "home"),
		INDUSCODE_DIR: isolatedIndusCodePath,
		INDUSCODE_DATA_DIR: dataDir,
		INDUSCODE_DB_DATA_DIR: path.join(dataDir, "db"),
		INDUSCODE_GLOBAL_SETTINGS_PATH: path.join(
			dataDir,
			"settings",
			"global-settings.json",
		),
		INDUSCODE_HOOKS_LOG_PATH: path.join(dataDir, "logs", "hooks.jsonl"),
		INDUSCODE_HUB_DISCOVERY_PATH: path.join(
			dataDir,
			"locks",
			"hub",
			"discovery.json",
		),
		INDUSCODE_HUB_PORT: nextHubPort(),
		INDUSCODE_MCP_SETTINGS_PATH: path.join(
			dataDir,
			"settings",
			"induscode_mcp_settings.json",
		),
		...(realProvidersFile
			? {}
			: {
					INDUSCODE_PROVIDER_SETTINGS_PATH: path.join(
						dataDir,
						"settings",
						"providers.json",
					),
				}),
		INDUSCODE_SESSION_DATA_DIR: path.join(dataDir, "sessions"),
		INDUSCODE_TEAM_DATA_DIR: path.join(dataDir, "teams"),
		INDUSCODE_DISABLE_INDUSCODE_PASS_NOTICE: "1",
		NO_UPDATE_NOTIFIER: "1",
		INDUSCODE_NO_AUTO_UPDATE: "1",
		...extra,
	};
}
