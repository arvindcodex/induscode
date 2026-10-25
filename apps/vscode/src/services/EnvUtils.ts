import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import { EmptyRequest } from "@/shared/proto/induscode/common"
import { Logger } from "@/shared/services/Logger"

// Canonical header names for extra client/host context
const IndusCodeHeaders = {
	PLATFORM: "X-PLATFORM",
	PLATFORM_VERSION: "X-PLATFORM-VERSION",
	CLIENT_VERSION: "X-CLIENT-VERSION",
	CLIENT_TYPE: "X-CLIENT-TYPE",
	CORE_VERSION: "X-CORE-VERSION",
	IS_MULTIROOT: "X-IS-MULTIROOT",
} as const

export function buildExternalBasicHeaders(): Record<string, string> {
	return {
		"User-Agent": `IndusCode/${ExtensionRegistryInfo.version}`,
	}
}

export async function buildBasicIndusCodeHeaders(): Promise<Record<string, string>> {
	const headers: Record<string, string> = buildExternalBasicHeaders()
	try {
		const host = await HostProvider.env.getHostVersion(EmptyRequest.create({}))
		headers[IndusCodeHeaders.PLATFORM] = host.platform || "unknown"
		headers[IndusCodeHeaders.PLATFORM_VERSION] = host.version || "unknown"
		headers[IndusCodeHeaders.CLIENT_TYPE] = host.induscodeType || "unknown"
		headers[IndusCodeHeaders.CLIENT_VERSION] = host.induscodeVersion || "unknown"
	} catch (error) {
		Logger.log("Failed to get IDE/platform info via HostBridge EnvService.getHostVersion", error)
		headers[IndusCodeHeaders.PLATFORM] = "unknown"
		headers[IndusCodeHeaders.PLATFORM_VERSION] = "unknown"
		headers[IndusCodeHeaders.CLIENT_TYPE] = "unknown"
		headers[IndusCodeHeaders.CLIENT_VERSION] = "unknown"
	}
	headers[IndusCodeHeaders.CORE_VERSION] = ExtensionRegistryInfo.version

	return headers
}
