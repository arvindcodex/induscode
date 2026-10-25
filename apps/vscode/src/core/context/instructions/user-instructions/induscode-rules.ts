import { resolveGlobalRulesConfigPaths, resolveWorkspaceRulesConfigPaths } from "@induscode/shared/storage"
import { combineRuleToggles, synchronizeRuleToggles } from "@core/context/instructions/user-instructions/rule-helpers"
import { ensureRulesDirectoryExists } from "@core/storage/disk"
import { IndusCodeRulesToggles } from "@shared/induscode-rules"
import { Controller } from "@/core/controller"

/**
 * Sub-directories of `.induscoderules` that hold non-rule config and must not be
 * surfaced as rules.
 */
const INDUSCODERULES_EXCLUDED_SUBDIRECTORIES: string[][] = [
	[".induscoderules", "workflows"],
	[".induscoderules", "hooks"],
	[".induscoderules", "skills"],
]

/**
 * Synchronizes rule toggles across every directory a rule may live in.
 * `synchronizeRuleToggles` prunes toggles for files outside the directory it
 * scans, so each directory is synchronized against the same starting state and
 * the results are combined (mirroring the multi-location handling for Cursor
 * rules in external-rules.ts).
 */
async function synchronizeRuleTogglesAcrossDirectories(
	directories: string[],
	currentToggles: IndusCodeRulesToggles,
	excludedPaths: string[][] = [],
): Promise<IndusCodeRulesToggles> {
	let combined: IndusCodeRulesToggles = {}
	for (const directory of directories) {
		const synchronized = await synchronizeRuleToggles(directory, currentToggles, "", excludedPaths)
		combined = combineRuleToggles(combined, synchronized)
	}
	return combined
}

export async function refreshIndusCodeRulesToggles(
	controller: Controller,
	workingDirectory: string,
): Promise<{
	globalToggles: IndusCodeRulesToggles
	localToggles: IndusCodeRulesToggles
}> {
	// Global toggles: the Documents-based directory the Rules tab creates files
	// in (resolved through the OS, so it follows redirected Documents folders),
	// plus every global location the shared SDK resolver loads rules from
	// (e.g. ~/.induscode/rules), so the panel shows what actually reaches the model.
	const globalIndusCodeRulesToggles = controller.stateManager.getGlobalSettingsKey("globalIndusCodeRulesToggles")
	const globalIndusCodeRulesFilePath = await ensureRulesDirectoryExists()
	const globalRuleDirectories = [...new Set([globalIndusCodeRulesFilePath, ...resolveGlobalRulesConfigPaths()])]
	const updatedGlobalToggles = await synchronizeRuleTogglesAcrossDirectories(globalRuleDirectories, globalIndusCodeRulesToggles)
	controller.stateManager.setGlobalState("globalIndusCodeRulesToggles", updatedGlobalToggles)

	// Local toggles: both supported workspace layouts — the legacy
	// `.induscoderules` directory (or single file) and `.induscode/rules` — via the
	// same shared resolver the SDK runtime loads rules with (induscode/induscode#14186).
	const localIndusCodeRulesToggles = controller.stateManager.getWorkspaceStateKey("localIndusCodeRulesToggles")
	const updatedLocalToggles = await synchronizeRuleTogglesAcrossDirectories(
		resolveWorkspaceRulesConfigPaths(workingDirectory),
		localIndusCodeRulesToggles,
		INDUSCODERULES_EXCLUDED_SUBDIRECTORIES,
	)
	controller.stateManager.setWorkspaceState("localIndusCodeRulesToggles", updatedLocalToggles)

	return {
		globalToggles: updatedGlobalToggles,
		localToggles: updatedLocalToggles,
	}
}
