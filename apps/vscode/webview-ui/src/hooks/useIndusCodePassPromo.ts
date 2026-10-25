import { useCallback, useMemo } from "react"
import { buildIndusCodePassSubscribeUrl, buildIndusCodePassSubscriptionPageUrl } from "@/components/onboarding/induscodePassSubscribe"
import { useApiConfigurationHandlers } from "@/components/settings/utils/useApiConfigurationHandlers"
import { useIndusCodeAuth } from "@/context/IndusCodeAuthContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { UiServiceClient } from "@/services/grpc-client"

export const INDUSCODE_PASS_PROVIDER_ID = "induscode-pass"

/**
 * Shared state + actions for the IndusCodePass promotional surfaces (home banner,
 * account page card, settings provider hint). Promotions are hidden in
 * self-hosted mode (IndusCodePass is a cloud subscription) and behind org
 * remote-config provider allowlists so they never offer a provider the
 * organization disallows.
 */
export function useIndusCodePassPromo() {
	const { apiConfiguration, environment, navigateToSettings, remoteConfigSettings, mode, planActSeparateModelsSetting } =
		useExtensionState()
	const { induscodeUser } = useIndusCodeAuth()
	const { handleModeFieldChange } = useApiConfigurationHandlers()

	const isSelfHostedOrUnknown = !environment || environment === "selfHosted"
	const remoteProviders: string[] = remoteConfigSettings?.remoteConfiguredProviders || []
	const isBlockedByRemoteConfig = remoteProviders.length > 0 && !remoteProviders.includes(INDUSCODE_PASS_PROVIDER_ID)
	const isIndusCodePassEnabled = !isSelfHostedOrUnknown && !isBlockedByRemoteConfig

	// Mirrors the switch action's scope: with separate plan/act models the
	// promos only affect (and therefore only reflect) the current mode.
	const currentModeProvider = mode === "plan" ? apiConfiguration?.planModeApiProvider : apiConfiguration?.actModeApiProvider
	const isUsingIndusCodePass = planActSeparateModelsSetting
		? currentModeProvider === INDUSCODE_PASS_PROVIDER_ID
		: apiConfiguration?.planModeApiProvider === INDUSCODE_PASS_PROVIDER_ID ||
			apiConfiguration?.actModeApiProvider === INDUSCODE_PASS_PROVIDER_ID

	const subscribeUrl = useMemo(() => buildIndusCodePassSubscribeUrl(induscodeUser?.appBaseUrl), [induscodeUser?.appBaseUrl])
	const manageSubscriptionUrl = useMemo(() => buildIndusCodePassSubscriptionPageUrl(induscodeUser?.appBaseUrl), [induscodeUser?.appBaseUrl])

	const openSubscribePage = useCallback(() => {
		UiServiceClient.openUrl({ value: subscribeUrl }).catch((err) =>
			console.error("Failed to open IndusCodePass subscribe page:", err),
		)
	}, [subscribeUrl])

	const openManageSubscriptionPage = useCallback(() => {
		UiServiceClient.openUrl({ value: manageSubscriptionUrl }).catch((err) =>
			console.error("Failed to open IndusCodePass subscription page:", err),
		)
	}, [manageSubscriptionUrl])

	// Selects IndusCodePass without navigating (for surfaces that already show the
	// provider settings inline). Mirrors the provider dropdown: updates both
	// modes, or only the current mode when plan/act use separate models, so the
	// other mode's provider is never silently overwritten. Returns whether the
	// provider update actually succeeded.
	const selectIndusCodePassProvider = useCallback(async (): Promise<boolean> => {
		try {
			await handleModeFieldChange({ plan: "planModeApiProvider", act: "actModeApiProvider" }, INDUSCODE_PASS_PROVIDER_ID, mode)
			return true
		} catch (error) {
			console.error("Failed to switch to IndusCodePass provider:", error)
			return false
		}
	}, [handleModeFieldChange, mode])

	// Selects IndusCodePass for both modes and lands the user on the provider
	// settings so they can pick a model / sign in. Only navigates when the
	// provider update succeeded, so a failure doesn't strand the user on the
	// settings page with their old provider still selected.
	const switchToIndusCodePassProvider = useCallback(async () => {
		if (await selectIndusCodePassProvider()) {
			navigateToSettings("api-config")
		}
	}, [selectIndusCodePassProvider, navigateToSettings])

	return {
		isIndusCodePassEnabled,
		isUsingIndusCodePass,
		subscribeUrl,
		manageSubscriptionUrl,
		openSubscribePage,
		openManageSubscriptionPage,
		selectIndusCodePassProvider,
		switchToIndusCodePassProvider,
	}
}
