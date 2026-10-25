import { WebviewProvider } from "./core/webview"
import "./utils/path" // necessary to have access to String.prototype.toPosix

import { setSdkLogger } from "@induscode/core"
import { HostProvider } from "@/hosts/host-provider"
import { Logger } from "@/shared/services/Logger"
import type { StorageContext } from "@/shared/storage/storage-context"
import { clearOnboardingModelsCache } from "./core/controller/models/getIndusCodeOnboardingModels"
import { HookDiscoveryCache } from "./core/hooks/HookDiscoveryCache"
import { HookProcessRegistry } from "./core/hooks/HookProcessRegistry"
import { StateManager } from "./core/storage/StateManager"
import { ExtensionRegistryInfo } from "./registry"
import { registerVsCodeLmHandler } from "./sdk/vscode-lm/register-vscode-lm"
import { registerIndusCodeClientIdentity } from "./services/IndusCodeClientIdentity"
import { ErrorService } from "./services/error"
import { featureFlagsService } from "./services/feature-flags"
import { getDistinctId } from "./services/logging/distinctId"
import { telemetryService } from "./services/telemetry"
import { PostHogClientProvider } from "./services/telemetry/providers/posthog/PostHogClientProvider"
import { IndusCodeTempManager } from "./services/temp"
import { ShowMessageType } from "./shared/proto/host/window"
import { syncWorker } from "./shared/services/worker/sync"
import { getBlobStoreSettingsFromEnv } from "./shared/services/worker/worker"
import { getLatestAnnouncementId } from "./utils/announcements"
import { arePathsEqual } from "./utils/path"

/**
 * Performs intialization for IndusCode that is common to all platforms.
 *
 * @param context
 * @returns The webview provider
 * @throws IndusCodeConfigurationError if endpoints.json exists but is invalid
 */
export async function initialize(storageContext: StorageContext): Promise<WebviewProvider> {
	// Configure the shared Logging class to use HostProvider's output channels and debug logger
	Logger.subscribe((msg: string) => HostProvider.get().logToChannel(msg)) // File system logging
	Logger.subscribe((msg: string) => HostProvider.env.debugLog({ value: msg })) // Host debug logging

	// Register the SDK early logger so diagnostic events from
	// ProviderSettingsManager, RuntimeOAuthTokenManager, and IndusCode auth
	// flow through Logger.debug → IndusCode output channel.
	// These components operate before/outside of IndusCodeCore sessions, so the
	// session-scoped logger can't reach them.
	setSdkLogger({
		debug: (message) => Logger.debug(message),
		log: (message) => Logger.log(message),
		error: (message) => Logger.error(message),
	})

	// Initialize IndusCodeEndpoint configuration (reads bundled and ~/.induscode/endpoints.json if present)
	// This must be done before any other code that calls IndusCodeEnv.config()
	// Throws IndusCodeConfigurationError if config file exists but is invalid
	const { IndusCodeEndpoint } = await import("./config")
	await IndusCodeEndpoint.initialize(HostProvider.get().extensionFsPath)

	try {
		await StateManager.initialize(storageContext)
	} catch (error) {
		Logger.error("[IndusCode] CRITICAL: Failed to initialize StateManager:", error)
		HostProvider.window.showMessage({
			type: ShowMessageType.ERROR,
			message: "Failed to initialize storage. Please check logs for details or try restarting the client.",
		})
	}

	void registerIndusCodeClientIdentity()

	// Register host-only SDK provider handlers (e.g. VS Code Language Model API),
	// which depend on the `vscode` module and cannot live in the SDK package.
	// Must run before any handler is built (standalone utilities or task loop).
	registerVsCodeLmHandler()

	// =============== External services ===============
	await ErrorService.initialize()
	// Initialize PostHog client provider (skip in self-hosted mode)
	if (!IndusCodeEndpoint.isSelfHosted()) {
		PostHogClientProvider.getInstance()
	}

	// =============== Webview services ===============
	const webview = HostProvider.get().createWebviewProvider()

	const stateManager = StateManager.get()
	// Non-blocking announcement check and display
	showVersionUpdateAnnouncement(stateManager)
	// Check if this workspace was opened from worktree quick launch
	await checkWorktreeAutoOpen(stateManager)

	// =============== Background sync and cleanup tasks ===============
	// Use remote config blobStoreConfig if available, otherwise fall back to env vars
	const blobStoreSettings = stateManager.getRemoteConfigSettings()?.blobStoreConfig ?? getBlobStoreSettingsFromEnv()
	syncWorker().init({ ...blobStoreSettings, userDistinctId: getDistinctId() })
	// Clean up old temp files in background (non-blocking) and start periodic cleanup every 24 hours
	IndusCodeTempManager.startPeriodicCleanup()

	telemetryService.captureExtensionActivated()

	return webview
}

async function showVersionUpdateAnnouncement(stateManager: StateManager) {
	// Version checking for autoupdate notification
	const currentVersion = ExtensionRegistryInfo.version
	const previousVersion = stateManager.getGlobalStateKey("induscodeVersion")
	// Perform post-update actions if necessary
	try {
		if (!previousVersion || currentVersion !== previousVersion) {
			Logger.log(`IndusCode version changed: ${previousVersion} -> ${currentVersion}. First run or update detected.`)

			// Check if there's a new announcement to show
			const lastShownAnnouncementId = stateManager.getGlobalStateKey("lastShownAnnouncementId")
			const latestAnnouncementId = getLatestAnnouncementId()

			if (lastShownAnnouncementId !== latestAnnouncementId) {
				// Show notification when there's a new announcement (major/minor updates or fresh installs)
				const message = previousVersion
					? `IndusCode has been updated to v${currentVersion}`
					: `Welcome to IndusCode v${currentVersion}`
				HostProvider.window.showMessage({
					type: ShowMessageType.INFORMATION,
					message,
				})
			}
			// Always update the main version tracker for the next launch.
			stateManager.setGlobalState("induscodeVersion", currentVersion)
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		Logger.error(`Error during post-update actions: ${errorMessage}, Stack trace: ${error.stack}`)
	}
}

/**
 * Checks if this workspace was opened from the worktree quick launch button.
 * If so, opens the IndusCode sidebar and clears the state.
 */
async function checkWorktreeAutoOpen(stateManager: StateManager): Promise<void> {
	try {
		// Read directly from globalState (not StateManager cache) since this may have been
		// set by another window right before this one opened
		const worktreeAutoOpenPath = stateManager.getGlobalStateKey("worktreeAutoOpenPath")
		if (!worktreeAutoOpenPath) {
			return
		}

		// Get current workspace path
		const workspacePaths = (await HostProvider.workspace.getWorkspacePaths({})).paths
		if (workspacePaths.length === 0) {
			return
		}

		const currentPath = workspacePaths[0]

		// Check if current workspace matches the worktree path
		if (arePathsEqual(currentPath, worktreeAutoOpenPath)) {
			// Clear the state first to prevent re-triggering
			stateManager.setGlobalState("worktreeAutoOpenPath", undefined)
			// Open the IndusCode sidebar
			await HostProvider.workspace.openIndusCodeSidebarPanel({})
		}
	} catch (error) {
		Logger.error("Error checking worktree auto-open", error)
	}
}

/**
 * Performs cleanup when IndusCode is deactivated that is common to all platforms.
 */
export async function tearDown(): Promise<void> {
	try {
		PostHogClientProvider.getInstance().dispose()
		telemetryService.dispose()
		ErrorService.get().dispose()
		featureFlagsService.dispose()
		// Dispose all webview instances
		await WebviewProvider.disposeAllInstances()
		syncWorker().dispose()
		clearOnboardingModelsCache()

		// Kill any running hook processes to prevent zombies
		await HookProcessRegistry.terminateAll()
		// Clean up hook discovery cache
		HookDiscoveryCache.getInstance().dispose()
		// Stop periodic temp file cleanup
		IndusCodeTempManager.stopPeriodicCleanup()
	} finally {
		try {
			await StateManager.get().flushPendingState()
		} catch (error) {
			Logger.error("[IndusCode] Failed to flush pending state during teardown:", error)
		}
	}
}
