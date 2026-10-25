import { getWorkspaceBasename } from "@core/workspace"
import type { ToggleIndusCodeRuleRequest } from "@shared/proto/induscode/file"
import { RuleScope, ToggleIndusCodeRules } from "@shared/proto/induscode/file"
import { telemetryService } from "@/services/telemetry"
import { Logger } from "@/shared/services/Logger"
import type { Controller } from "../index"

/**
 * Toggles a IndusCode rule (enable or disable)
 * @param controller The controller instance
 * @param request The toggle request
 * @returns The updated IndusCode rule toggles
 */
export async function toggleIndusCodeRule(
	controller: Controller,
	request: ToggleIndusCodeRuleRequest,
): Promise<ToggleIndusCodeRules> {
	const { scope, rulePath, enabled } = request

	if (!rulePath || typeof enabled !== "boolean" || scope === undefined) {
		Logger.error("toggleIndusCodeRule: Missing or invalid parameters", {
			rulePath,
			scope,
			enabled: typeof enabled === "boolean" ? enabled : `Invalid: ${typeof enabled}`,
		})
		throw new Error("Missing or invalid parameters for toggleIndusCodeRule")
	}

	// Handle the three different scopes
	switch (scope) {
		case RuleScope.GLOBAL: {
			const toggles = controller.stateManager.getGlobalSettingsKey("globalIndusCodeRulesToggles")
			toggles[rulePath] = enabled
			controller.stateManager.setGlobalState("globalIndusCodeRulesToggles", toggles)
			break
		}
		case RuleScope.LOCAL: {
			const toggles = controller.stateManager.getWorkspaceStateKey("localIndusCodeRulesToggles")
			toggles[rulePath] = enabled
			controller.stateManager.setWorkspaceState("localIndusCodeRulesToggles", toggles)
			break
		}
		case RuleScope.REMOTE: {
			const toggles = controller.stateManager.getGlobalStateKey("remoteRulesToggles")
			toggles[rulePath] = enabled
			controller.stateManager.setGlobalState("remoteRulesToggles", toggles)
			break
		}
		default:
			throw new Error(`Invalid scope: ${scope}`)
	}

	// Track rule toggle telemetry with current task context
	if (controller.task?.ulid) {
		// Extract just the filename for privacy (no full paths)
		const ruleFileName = getWorkspaceBasename(rulePath, "Controller.toggleIndusCodeRule")
		const isGlobal = scope === RuleScope.GLOBAL
		telemetryService.captureIndusCodeRuleToggled(controller.task.ulid, ruleFileName, enabled, isGlobal)
	}

	// Get the current state to return in the response
	const globalToggles = controller.stateManager.getGlobalSettingsKey("globalIndusCodeRulesToggles")
	const localToggles = controller.stateManager.getWorkspaceStateKey("localIndusCodeRulesToggles")
	const remoteToggles = controller.stateManager.getGlobalStateKey("remoteRulesToggles")

	return ToggleIndusCodeRules.create({
		globalIndusCodeRulesToggles: { toggles: globalToggles },
		localIndusCodeRulesToggles: { toggles: localToggles },
		remoteRulesToggles: { toggles: remoteToggles },
	})
}
