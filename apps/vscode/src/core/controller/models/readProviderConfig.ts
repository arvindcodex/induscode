import { StringRequest } from "@/shared/proto/induscode/common"
import { ProviderConfigResponse } from "@/shared/proto/induscode/models"
import { type ProviderCatalogController, parseProviderIdRequest, toRedactedProviderConfigResponse } from "./providerCatalogShared"

export async function readProviderConfig(
	controller: ProviderCatalogController,
	request: StringRequest,
): Promise<ProviderConfigResponse> {
	const providerId = parseProviderIdRequest(request.value, "value")
	const store = controller.getProviderConfigStore()
	return toRedactedProviderConfigResponse(store.read(providerId), store)
}
