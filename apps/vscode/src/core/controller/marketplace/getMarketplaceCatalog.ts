import type { EmptyRequest } from "@shared/proto/induscode/common"
import type { MarketplaceCatalog } from "@shared/proto/induscode/marketplace"
import type { Controller } from "../index"
import { fetchMarketplaceCatalog, isMcpEntryAllowedByPolicy } from "./marketplace-helpers"

export async function getMarketplaceCatalog(controller: Controller, _request: EmptyRequest): Promise<MarketplaceCatalog> {
	const catalog = await fetchMarketplaceCatalog()
	// Filter out MCP entries blocked by enterprise remote config so they never reach the webview.
	const policy = controller.stateManager.getRemoteConfigSettings()
	return { ...catalog, entries: catalog.entries.filter((entry) => isMcpEntryAllowedByPolicy(entry, policy)) }
}
