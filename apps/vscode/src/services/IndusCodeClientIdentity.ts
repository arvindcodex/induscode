import { setIndusCodeClientIdentity } from "@induscode/shared"
import { HostProvider } from "@/hosts/host-provider"
import { ExtensionRegistryInfo } from "@/registry"
import { IndusCodeClient } from "@/shared/induscode"
import { EmptyRequest } from "@/shared/proto/induscode/common"
import { Logger } from "@/shared/services/Logger"

export async function registerIndusCodeClientIdentity(): Promise<void> {
	try {
		const host = await HostProvider.env.getHostVersion(EmptyRequest.create({}))
		setIndusCodeClientIdentity({
			name: host.induscodeType || IndusCodeClient.VSCode,
			version: host.induscodeVersion || ExtensionRegistryInfo.version,
			platform: host.platform || undefined,
			platformVersion: host.version || undefined,
		})
	} catch (error) {
		Logger.log("Failed to get IDE/platform info via HostBridge EnvService.getHostVersion", error)
		setIndusCodeClientIdentity({
			name: IndusCodeClient.VSCode,
			version: ExtensionRegistryInfo.version,
		})
	}
}
