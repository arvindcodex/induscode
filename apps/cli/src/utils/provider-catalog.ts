import {
	listLocalProviders as internalListLocalProviders,
	type ProviderSettingsManager,
} from "@induscode/core";

export async function listLocalProviders(
	manager: ProviderSettingsManager,
): ReturnType<typeof internalListLocalProviders> {
	return await internalListLocalProviders(manager, {
		isIndusCodePassEnabled: true,
	});
}
